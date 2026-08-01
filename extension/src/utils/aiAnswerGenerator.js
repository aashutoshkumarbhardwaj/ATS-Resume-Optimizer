/**
 * AI Answer Generator - Phase 2 Enhancement
 * Generates personalized answers to common interview questions
 * Uses resume and job description for context
 */

class AIAnswerGenerator {
    static COMMON_QUESTIONS = {
        whyHireYou: "Why should we hire you?",
        aboutYou: "Tell us about yourself",
        whyCompany: "Why do you want to work for us?",
        strengthsWeaknesses: "What are your strengths and weaknesses?",
        careerGoals: "Where do you see yourself in 5 years?",
        handleConflict: "How do you handle conflict in the workplace?",
        teamwork: "Tell us about a time you worked in a team",
        leadership: "Describe your leadership style",
        failureHandling: "Tell us about a time you failed",
        motivation: "What motivates you?",
        salaryExpectation: "What are your salary expectations?",
        relocation: "Are you willing to relocate?",
        availability: "When can you start?"
    };

    /**
     * Generate personalized answer for a question
     */
    static async generateAnswer(question, resume, jobDescription, options = {}) {
        const { style = 'professional', maxLength = 500 } = options;

        if (!resume || !jobDescription) {
            return {
                success: false,
                error: 'Resume and job description required'
            };
        }

        try {
            // Normalize question
            const normalizedQuestion = this.normalizeQuestion(question);

            // Generate context-specific answer
            let answer = '';

            switch (normalizedQuestion) {
                case 'whyHireYou':
                    answer = this.generateWhyHireYou(resume, jobDescription);
                    break;

                case 'aboutYou':
                    answer = this.generateAboutYou(resume, jobDescription);
                    break;

                case 'whyCompany':
                    answer = this.generateWhyCompany(resume, jobDescription);
                    break;

                case 'strengthsWeaknesses':
                    answer = this.generateStrengthsWeaknesses(resume, jobDescription);
                    break;

                case 'careerGoals':
                    answer = this.generateCareerGoals(resume, jobDescription);
                    break;

                case 'handleConflict':
                    answer = this.generateConflictHandling(resume);
                    break;

                case 'teamwork':
                    answer = this.generateTeamwork(resume);
                    break;

                case 'leadership':
                    answer = this.generateLeadershipStyle(resume);
                    break;

                case 'failureHandling':
                    answer = this.generateFailureHandling(resume);
                    break;

                case 'motivation':
                    answer = this.generateMotivation(resume, jobDescription);
                    break;

                case 'salaryExpectation':
                    answer = this.generateSalaryExpectation(resume, jobDescription);
                    break;

                case 'relocation':
                    answer = this.generateRelocation(resume);
                    break;

                case 'availability':
                    answer = this.generateAvailability(resume);
                    break;

                default:
                    answer = this.generateGenericAnswer(question, resume, jobDescription);
            }

            // Enforce max length
            if (answer.length > maxLength) {
                answer = answer.substring(0, maxLength).trim() + '...';
            }

            return {
                success: true,
                question,
                answer,
                wordCount: answer.split(' ').length,
                style
            };

        } catch (error) {
            console.error('[AIAnswerGenerator] Error generating answer:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Normalize question to match our template
     */
    static normalizeQuestion(question) {
        const lowerQuestion = question.toLowerCase();

        for (const [key, value] of Object.entries(this.COMMON_QUESTIONS)) {
            if (lowerQuestion.includes(value.toLowerCase().split(' ')[0])) {
                return key;
            }
        }

        // Check for specific keywords
        if (lowerQuestion.includes('hire')) return 'whyHireYou';
        if (lowerQuestion.includes('about yourself')) return 'aboutYou';
        if (lowerQuestion.includes('why') && lowerQuestion.includes('company')) return 'whyCompany';
        if (lowerQuestion.includes('strength')) return 'strengthsWeaknesses';
        if (lowerQuestion.includes('five year') || lowerQuestion.includes('5 year')) return 'careerGoals';
        if (lowerQuestion.includes('conflict')) return 'handleConflict';
        if (lowerQuestion.includes('team')) return 'teamwork';
        if (lowerQuestion.includes('leadership')) return 'leadership';
        if (lowerQuestion.includes('fail')) return 'failureHandling';
        if (lowerQuestion.includes('motivat')) return 'motivation';
        if (lowerQuestion.includes('salary')) return 'salaryExpectation';
        if (lowerQuestion.includes('reloca')) return 'relocation';
        if (lowerQuestion.includes('start')) return 'availability';

        return 'generic';
    }

    /**
     * Generate "Why should we hire you?" answer
     */
    static generateWhyHireYou(resume, jobDescription) {
        const skills = this.extractMatchingSkills(resume, jobDescription);
        const experience = this.extractRelevantExperience(resume, jobDescription);
        const company = this.extractCompanyName(jobDescription);

        let answer = `I should be hired because I have a strong background in ${skills.slice(0, 2).join(' and ')} with proven experience building solutions like the ones your team is working on. `;

        if (experience) {
            answer += `In my previous role at ${experience.company}, I ${experience.achievement}. `;
        }

        answer += `I'm excited about the opportunity to contribute my skills to ${company} and grow with your team.`;

        return answer;
    }

    /**
     * Generate "Tell us about yourself" answer
     */
    static generateAboutYou(resume, jobDescription) {
        const name = resume.contact?.firstName || 'I';
        const currentTitle = resume.experience?.[0]?.title || 'a software professional';
        const yearsExp = this.calculateExperience(resume.experience);
        const skills = this.extractMatchingSkills(resume, jobDescription).slice(0, 3);

        let answer = `I'm a ${currentTitle} with ${yearsExp} years of professional experience. `;
        answer += `Throughout my career, I've specialized in ${skills.join(', ')}. `;
        answer += `I'm passionate about solving complex problems and delivering high-quality solutions. `;
        answer += `I'm particularly interested in this role because it aligns with my expertise and career goals.`;

        return answer;
    }

    /**
     * Generate "Why this company?" answer
     */
    static generateWhyCompany(resume, jobDescription) {
        const company = this.extractCompanyName(jobDescription);
        const jobTitle = this.extractJobTitle(jobDescription);
        const skills = this.extractMatchingSkills(resume, jobDescription).slice(0, 2);

        let answer = `I'm interested in joining ${company} because of your reputation for innovation and excellence. `;
        answer += `The ${jobTitle} role is particularly appealing because it involves ${skills.join(' and ')}, which are areas I'm passionate about. `;
        answer += `I believe my background and skills make me a good fit for your team, and I'm excited about the opportunity to contribute to your mission.`;

        return answer;
    }

    /**
     * Generate strengths and weaknesses answer
     */
    static generateStrengthsWeaknesses(resume, jobDescription) {
        const skills = this.extractMatchingSkills(resume, jobDescription).slice(0, 2);

        let answer = `My main strengths are ${skills[0]} and attention to detail. I have consistently delivered projects on time and maintained high code quality. `;
        answer += `As for weaknesses, I'm continuously working on improving my public speaking skills. I've been taking courses and presenting more frequently to become a better communicator.`;

        return answer;
    }

    /**
     * Generate career goals answer
     */
    static generateCareerGoals(resume, jobDescription) {
        const currentTitle = resume.experience?.[0]?.title || 'developer';
        const company = this.extractCompanyName(jobDescription);

        let answer = `In five years, I see myself as a senior ${currentTitle} or technical lead, contributing to strategic decisions and mentoring junior developers. `;
        answer += `I want to deepen my expertise in my core areas while also developing leadership skills. `;
        answer += `Working at ${company} would be a great step toward these goals, as I'd have the opportunity to work on impactful projects and collaborate with talented professionals.`;

        return answer;
    }

    /**
     * Generate conflict handling answer
     */
    static generateConflictHandling(resume) {
        return `I believe in addressing conflicts directly and professionally. I focus on understanding different perspectives and finding common ground. ` +
               `I'm a good listener and believe that most conflicts arise from miscommunication. ` +
               `I always try to approach disagreements with empathy and a problem-solving mindset rather than a confrontational one.`;
    }

    /**
     * Generate teamwork answer
     */
    static generateTeamwork(resume) {
        const company = resume.experience?.[0]?.company || 'a tech company';
        const project = resume.experience?.[0]?.bullets?.[0] || 'multiple projects';

        return `During my time at ${company}, I worked on ${project}. ` +
               `I collaborated closely with designers, product managers, and other developers to ensure alignment and deliver quality results. ` +
               `I'm a strong believer in open communication and regular feedback. ` +
               `I contributed by sharing ideas, helping teammates when they were stuck, and being reliable in delivering my commitments.`;
    }

    /**
     * Generate leadership style answer
     */
    static generateLeadershipStyle(resume) {
        return `My leadership style is collaborative and inclusive. I believe in empowering team members to make decisions and take ownership of their work. ` +
               `I focus on clear communication, setting expectations, and providing constructive feedback. ` +
               `I lead by example and believe that a good leader removes blockers and helps their team succeed. ` +
               `I'm also open to learning from my team members and believe that the best ideas can come from anywhere.`;
    }

    /**
     * Generate failure handling answer
     */
    static generateFailureHandling(resume) {
        return `Early in my career, I worked on a project that didn't meet the initial deadline due to unclear requirements. ` +
               `Instead of making excuses, I took it as a learning opportunity. ` +
               `I implemented better communication processes with stakeholders and improved our project management practices. ` +
               `The next project was completed on time and with better quality. ` +
               `This taught me the importance of asking clarifying questions upfront and maintaining clear communication throughout the project.`;
    }

    /**
     * Generate motivation answer
     */
    static generateMotivation(resume, jobDescription) {
        const skills = this.extractMatchingSkills(resume, jobDescription).slice(0, 1);

        return `I'm motivated by the opportunity to solve complex problems and create solutions that make a real impact. ` +
               `I'm passionate about ${skills[0]} and enjoy continuously learning and improving my skills. ` +
               `I'm also driven by working with talented people and being part of a team with a shared mission. ` +
               `Personal growth and contributing to something meaningful are the main drivers for my career choices.`;
    }

    /**
     * Generate salary expectation answer
     */
    static generateSalaryExpectation(resume, jobDescription) {
        const salary = resume.expectedSalary || resume.currentSalary;

        if (salary) {
            return `Based on my experience and the market rate for this role, I'm looking for a salary in the range of ${salary}. ` +
                   `However, I'm flexible and open to discussing the full compensation package, including benefits and growth opportunities.`;
        }

        return `I'm flexible with salary and am more interested in finding a role where I can contribute meaningfully and grow professionally. ` +
               `I'd be happy to discuss what's competitive for this role and market conditions.`;
    }

    /**
     * Generate relocation answer
     */
    static generateRelocation(resume) {
        const location = resume.contact?.city || 'the area';

        return `Yes, I'm open to relocation for the right opportunity. ` +
               `While I'm currently based in ${location}, I'm excited about the prospect of joining your team and am willing to make the move if necessary.`;
    }

    /**
     * Generate availability answer
     */
    static generateAvailability(resume) {
        return `I'm currently employed and providing a two-week notice is standard. ` +
               `So ideally, I could start two weeks from the offer date. ` +
               `However, I'm flexible and can discuss the timeline based on your needs and circumstances.`;
    }

    /**
     * Generate generic answer for unknown questions
     */
    static generateGenericAnswer(question, resume, jobDescription) {
        const skills = this.extractMatchingSkills(resume, jobDescription).slice(0, 2);

        return `This is a great question. In my experience, ${skills[0]} and strong problem-solving skills are essential. ` +
               `I approach this by ${skills[1] ? `combining my expertise in ${skills[0]} with ` : ''}continuous learning and collaboration with my team. ` +
               `I believe that success comes from balancing technical excellence with good communication and teamwork.`;
    }

    /**
     * Extract matching skills between resume and JD
     */
    static extractMatchingSkills(resume, jobDescription) {
        const resumeSkills = new Set(
            (resume.skills || []).map(s => s.toLowerCase()),
            (resume.experience?.[0]?.bullets || []).flatMap(b =>
                b.match(/\b(javascript|python|java|react|node|sql|aws|docker)\b/gi) || []
            ).map(s => s.toLowerCase())
        );

        const jdSkills = (jobDescription.description || '').match(
            /\b(javascript|python|java|react|node|sql|aws|docker|typescript|vue|angular|express|mongodb|postgresql)\b/gi
        ) || [];

        const matching = Array.from(resumeSkills).filter(skill =>
            jdSkills.some(jdSkill => jdSkill.toLowerCase() === skill.toLowerCase())
        );

        return matching.length > 0 ? matching : Array.from(resumeSkills).slice(0, 3);
    }

    /**
     * Extract relevant experience from resume
     */
    static extractRelevantExperience(resume, jobDescription) {
        if (!resume.experience || resume.experience.length === 0) return null;

        const mostRecent = resume.experience[0];
        return {
            company: mostRecent.company,
            achievement: mostRecent.bullets?.[0] || 'delivered quality solutions'
        };
    }

    /**
     * Extract job title from job description
     */
    static extractJobTitle(jobDescription) {
        return jobDescription.jobTitle || 'this role';
    }

    /**
     * Extract company name from job description
     */
    static extractCompanyName(jobDescription) {
        return jobDescription.company || 'your company';
    }

    /**
     * Calculate years of experience
     */
    static calculateExperience(experience) {
        if (!experience || experience.length === 0) return 0;

        let totalMonths = 0;

        for (const exp of experience) {
            const startDate = this.parseDate(exp.startDate);
            const endDate = exp.endDate ? this.parseDate(exp.endDate) : new Date();

            if (startDate && endDate) {
                const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                    (endDate.getMonth() - startDate.getMonth());
                totalMonths += months;
            }
        }

        return Math.floor(totalMonths / 12) || 0;
    }

    /**
     * Parse date string
     */
    static parseDate(dateString) {
        if (!dateString) return null;

        try {
            return new Date(dateString);
        } catch {
            return null;
        }
    }

    /**
     * Store edited answer for memory
     */
    static async saveEditedAnswer(question, originalAnswer, editedAnswer, metadata = {}) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['aiAnswerMemory'], (result) => {
                const memory = result.aiAnswerMemory || [];

                memory.push({
                    question,
                    originalAnswer,
                    editedAnswer,
                    timestamp: Date.now(),
                    metadata
                });

                chrome.storage.local.set({ aiAnswerMemory: memory.slice(-50) }, () => {
                    resolve(true);
                });
            });
        });
    }

    /**
     * Get previous answers for question
     */
    static async getPreviousAnswers(question) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['aiAnswerMemory'], (result) => {
                const memory = result.aiAnswerMemory || [];
                const matching = memory.filter(m =>
                    m.question.toLowerCase() === question.toLowerCase()
                );

                resolve(matching);
            });
        });
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIAnswerGenerator;
}
