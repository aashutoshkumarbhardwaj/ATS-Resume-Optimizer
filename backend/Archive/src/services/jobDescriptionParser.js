/**
 * Job Description Parser Service
 * Extracts structured data from raw job description text
 */

const crypto = require('crypto');
const cache = require('../utils/cache');

class JobDescriptionParser {
    /**
     * Parse job description into structured data with caching
     */
    static parse(jobDescription) {
        if (!jobDescription || typeof jobDescription !== 'string') {
            throw new Error('Invalid job description');
        }

        // Generate cache key from job description hash
        const cacheKey = 'job_' + crypto.createHash('md5').update(jobDescription).digest('hex');
        
        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log('Job description retrieved from cache');
            return cached;
        }

        // Parse job description
        const sections = this.identifySections(jobDescription);
        const keywords = this.extractKeywords(jobDescription, sections);
        const requirements = this.classifyRequirements(jobDescription, sections);
        const metadata = this.extractMetadata(jobDescription);

        const result = {
            sections,
            keywords,
            requirements,
            metadata,
            rawText: jobDescription
        };

        // Cache the result for 1 hour
        cache.set(cacheKey, result, 60 * 60 * 1000);

        return result;
    }

    /**
     * Identify different sections in the job description
     */
    static identifySections(text) {
        const sections = {
            responsibilities: '',
            requirements: '',
            qualifications: '',
            benefits: '',
            about: '',
            other: ''
        };

        const lines = text.split('\n');
        let currentSection = 'other';
        let sectionContent = [];

        // Section header patterns
        const sectionPatterns = {
            responsibilities: /^(responsibilities|duties|what you('ll| will) do|role|job description|key responsibilities)/i,
            requirements: /^(requirements|required|must have|what we('re| are) looking for|minimum qualifications)/i,
            qualifications: /^(qualifications|preferred|nice to have|bonus|plus|ideal candidate|desired)/i,
            benefits: /^(benefits|perks|what we offer|compensation|why join|why work)/i,
            about: /^(about|who we are|company|our mission|our team)/i
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) {
                continue;
            }

            // Check if this line is a section header
            let foundSection = false;
            for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
                if (pattern.test(line)) {
                    // Save previous section content
                    if (sectionContent.length > 0) {
                        sections[currentSection] = sectionContent.join('\n').trim();
                        sectionContent = [];
                    }
                    currentSection = sectionName;
                    foundSection = true;
                    break;
                }
            }

            if (!foundSection) {
                sectionContent.push(line);
            }
        }

        // Save last section
        if (sectionContent.length > 0) {
            sections[currentSection] = sectionContent.join('\n').trim();
        }

        return sections;
    }

    /**
     * Extract keywords from job description
     */
    static extractKeywords(text, sections) {
        const keywords = {
            technical: [],
            soft: [],
            tools: [],
            certifications: []
        };

        const lowerText = text.toLowerCase();

        // Technical skills database
        const technicalSkills = [
            // Programming Languages
            'javascript', 'typescript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'php', 
            'swift', 'kotlin', 'go', 'rust', 'scala', 'r', 'matlab', 'perl',
            
            // Frontend
            'react', 'angular', 'vue\\.?js', 'svelte', 'next\\.?js', 'nuxt', 'html5?', 'css3?',
            'sass', 'scss', 'less', 'tailwind', 'bootstrap', 'material-?ui', 'webpack', 'vite',
            
            // Backend
            'node\\.?js', 'express', 'django', 'flask', 'spring', 'spring boot', 'asp\\.net',
            'laravel', 'rails', 'fastapi', 'nestjs',
            
            // Databases
            'mongodb', 'postgresql', 'mysql', 'sql', 'nosql', 'redis', 'elasticsearch',
            'dynamodb', 'cassandra', 'oracle', 'sql server', 'sqlite',
            
            // Cloud & DevOps
            'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'jenkins',
            'ci/cd', 'terraform', 'ansible', 'cloudformation', 'helm',
            
            // Data & ML
            'machine learning', 'deep learning', 'ai', 'artificial intelligence', 'data science',
            'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy', 'spark',
            'hadoop', 'airflow', 'kafka',
            
            // Mobile
            'ios', 'android', 'react native', 'flutter', 'xamarin', 'swift', 'kotlin',
            
            // Other
            'rest api', 'graphql', 'microservices', 'serverless', 'lambda', 'api',
            'websocket', 'grpc', 'oauth', 'jwt', 'saml'
        ];

        // Soft skills database
        const softSkills = [
            'leadership', 'communication', 'teamwork', 'collaboration', 'problem solving',
            'analytical', 'critical thinking', 'creativity', 'adaptability', 'time management',
            'project management', 'mentoring', 'coaching', 'presentation', 'negotiation',
            'conflict resolution', 'decision making', 'strategic thinking', 'attention to detail',
            'self-motivated', 'proactive', 'organized', 'multitasking'
        ];

        // Tools database
        const tools = [
            'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'slack', 'trello',
            'asana', 'notion', 'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator',
            'postman', 'swagger', 'vs code', 'intellij', 'eclipse', 'visual studio'
        ];

        // Certifications database
        const certifications = [
            'aws certified', 'azure certified', 'gcp certified', 'pmp', 'scrum master',
            'csm', 'psm', 'cissp', 'comptia', 'ceh', 'cka', 'ckad'
        ];

        // Extract technical skills
        technicalSkills.forEach(skill => {
            const regex = new RegExp('\\b' + skill + '\\b', 'gi');
            const matches = text.match(regex);
            if (matches) {
                const normalized = matches[0].toLowerCase();
                if (!keywords.technical.includes(normalized)) {
                    keywords.technical.push(normalized);
                }
            }
        });

        // Extract soft skills
        softSkills.forEach(skill => {
            const regex = new RegExp('\\b' + skill + '\\b', 'gi');
            if (regex.test(lowerText)) {
                if (!keywords.soft.includes(skill)) {
                    keywords.soft.push(skill);
                }
            }
        });

        // Extract tools
        tools.forEach(tool => {
            const regex = new RegExp('\\b' + tool + '\\b', 'gi');
            if (regex.test(lowerText)) {
                if (!keywords.tools.includes(tool)) {
                    keywords.tools.push(tool);
                }
            }
        });

        // Extract certifications
        certifications.forEach(cert => {
            const regex = new RegExp(cert, 'gi');
            if (regex.test(lowerText)) {
                if (!keywords.certifications.includes(cert)) {
                    keywords.certifications.push(cert);
                }
            }
        });

        return keywords;
    }

    /**
     * Classify requirements as required vs preferred
     */
    static classifyRequirements(text, sections) {
        const requirements = {
            required: [],
            preferred: []
        };

        // Get requirements and qualifications sections
        const reqText = sections.requirements || '';
        const qualText = sections.qualifications || '';

        // Extract bullet points from requirements section (these are usually required)
        const reqLines = reqText.split('\n');
        reqLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.match(/^[•\-\*\d+\.]/)) {
                const cleaned = trimmed.replace(/^[•\-\*\d+\.]\s*/, '').trim();
                if (cleaned.length > 10) {
                    requirements.required.push(cleaned);
                }
            }
        });

        // Extract bullet points from qualifications section (these are usually preferred)
        const qualLines = qualText.split('\n');
        qualLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.match(/^[•\-\*\d+\.]/)) {
                const cleaned = trimmed.replace(/^[•\-\*\d+\.]\s*/, '').trim();
                if (cleaned.length > 10) {
                    requirements.preferred.push(cleaned);
                }
            }
        });

        // If no structured sections found, try to extract from full text
        if (requirements.required.length === 0 && requirements.preferred.length === 0) {
            const lines = text.split('\n');
            let inRequiredSection = false;
            let inPreferredSection = false;

            lines.forEach(line => {
                const trimmed = line.trim();
                const lower = trimmed.toLowerCase();

                // Check for section headers
                if (lower.match(/^(required|must have|minimum)/)) {
                    inRequiredSection = true;
                    inPreferredSection = false;
                } else if (lower.match(/^(preferred|nice to have|bonus|plus)/)) {
                    inRequiredSection = false;
                    inPreferredSection = true;
                }

                // Extract bullet points
                if (trimmed.match(/^[•\-\*\d+\.]/)) {
                    const cleaned = trimmed.replace(/^[•\-\*\d+\.]\s*/, '').trim();
                    if (cleaned.length > 10) {
                        if (inRequiredSection) {
                            requirements.required.push(cleaned);
                        } else if (inPreferredSection) {
                            requirements.preferred.push(cleaned);
                        } else {
                            // Default to required if no section context
                            requirements.required.push(cleaned);
                        }
                    }
                }
            });
        }

        return requirements;
    }

    /**
     * Extract metadata like experience level and years required
     */
    static extractMetadata(text) {
        const metadata = {
            experienceLevel: '',
            yearsRequired: 0,
            educationLevel: '',
            employmentType: ''
        };

        const lowerText = text.toLowerCase();

        // Extract experience level
        if (lowerText.match(/\b(senior|sr\.|lead|principal|staff)\b/)) {
            metadata.experienceLevel = 'Senior';
        } else if (lowerText.match(/\b(mid-level|intermediate|mid level)\b/)) {
            metadata.experienceLevel = 'Mid-Level';
        } else if (lowerText.match(/\b(junior|jr\.|entry|entry-level|entry level)\b/)) {
            metadata.experienceLevel = 'Junior';
        } else if (lowerText.match(/\b(intern|internship)\b/)) {
            metadata.experienceLevel = 'Intern';
        }

        // Extract years of experience
        const yearsMatch = text.match(/(\d+)\+?\s*years?\s*(of)?\s*experience/i);
        if (yearsMatch) {
            metadata.yearsRequired = parseInt(yearsMatch[1]);
        }

        // Extract education level
        if (lowerText.match(/\b(phd|ph\.d|doctorate)\b/)) {
            metadata.educationLevel = 'PhD';
        } else if (lowerText.match(/\b(master|masters|ms|m\.s|mba|m\.b\.a)\b/)) {
            metadata.educationLevel = 'Masters';
        } else if (lowerText.match(/\b(bachelor|bachelors|bs|b\.s|ba|b\.a|degree)\b/)) {
            metadata.educationLevel = 'Bachelors';
        }

        // Extract employment type
        if (lowerText.match(/\b(full-time|full time|fulltime)\b/)) {
            metadata.employmentType = 'Full-Time';
        } else if (lowerText.match(/\b(part-time|part time|parttime)\b/)) {
            metadata.employmentType = 'Part-Time';
        } else if (lowerText.match(/\b(contract|contractor)\b/)) {
            metadata.employmentType = 'Contract';
        } else if (lowerText.match(/\b(intern|internship)\b/)) {
            metadata.employmentType = 'Internship';
        }

        return metadata;
    }

    /**
     * Extract N-grams for multi-word skills
     */
    static extractNGrams(text, n = 2) {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);

        const ngrams = [];
        for (let i = 0; i <= words.length - n; i++) {
            const ngram = words.slice(i, i + n).join(' ');
            ngrams.push(ngram);
        }

        return ngrams;
    }
}

module.exports = JobDescriptionParser;
