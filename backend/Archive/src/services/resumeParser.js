/**
 * Resume Parser Service
 * Extracts structured data from resume text
 */

class ResumeParser {
    /**
     * Parse resume text into structured data
     */
    static parse(resumeText) {
        if (!resumeText || typeof resumeText !== 'string') {
            throw new Error('Invalid resume text');
        }

        const parsedData = {
            contact: this.extractContact(resumeText),
            summary: this.extractSummary(resumeText),
            experience: this.extractExperience(resumeText),
            education: this.extractEducation(resumeText),
            skills: this.extractSkills(resumeText),
            certifications: this.extractCertifications(resumeText)
        };

        return parsedData;
    }

    /**
     * Extract contact information
     */
    static extractContact(text) {
        const contact = {
            name: '',
            email: '',
            phone: '',
            location: '',
            linkedin: ''
        };

        // Extract email
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const emailMatch = text.match(emailRegex);
        if (emailMatch) {
            contact.email = emailMatch[0];
        }

        // Extract phone
        const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
        const phoneMatch = text.match(phoneRegex);
        if (phoneMatch) {
            contact.phone = phoneMatch[0];
        }

        // Extract LinkedIn
        const linkedinRegex = /(linkedin\.com\/in\/[\w-]+)/i;
        const linkedinMatch = text.match(linkedinRegex);
        if (linkedinMatch) {
            contact.linkedin = linkedinMatch[0];
        }

        // Extract name (usually first line or near contact info)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
            // Name is typically the first line, should be 2-4 words, capitalized
            const firstLine = lines[0];
            if (firstLine.length < 50 && firstLine.match(/^[A-Z][a-z]+(\s[A-Z][a-z]+){1,3}$/)) {
                contact.name = firstLine;
            }
        }

        // Extract location (city, state or city, country)
        const locationRegex = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)/;
        const locationMatch = text.match(locationRegex);
        if (locationMatch) {
            contact.location = locationMatch[0];
        }

        return contact;
    }

    /**
     * Extract professional summary
     */
    static extractSummary(text) {
        const summaryPatterns = [
            /summary[:\s]+([\s\S]{50,500}?)(?=\n\n|\nexperience|\neducation|\nskills)/i,
            /professional summary[:\s]+([\s\S]{50,500}?)(?=\n\n|\nexperience|\neducation|\nskills)/i,
            /profile[:\s]+([\s\S]{50,500}?)(?=\n\n|\nexperience|\neducation|\nskills)/i,
            /objective[:\s]+([\s\S]{50,500}?)(?=\n\n|\nexperience|\neducation|\nskills)/i
        ];

        for (const pattern of summaryPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return '';
    }

    /**
     * Extract work experience
     */
    static extractExperience(text) {
        const experience = [];
        
        // Find experience section
        const expSectionRegex = /(?:experience|work history|employment)[:\s]+([\s\S]+?)(?=\n(?:education|skills|certifications|projects)|$)/i;
        const expMatch = text.match(expSectionRegex);
        
        if (!expMatch) {
            return experience;
        }

        const expSection = expMatch[1];
        const lines = expSection.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let currentJob = null;
        let bullets = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check if this is a job title line (usually has company name and dates)
            const datePattern = /\b(20\d{2}|19\d{2})\b/;
            const hasDate = datePattern.test(line);

            // Check if line looks like a job title/company
            const isJobHeader = hasDate || (line.length < 100 && !line.match(/^[•\-\*]/));

            if (isJobHeader && line.length > 5) {
                // Save previous job if exists
                if (currentJob) {
                    currentJob.bullets = bullets;
                    experience.push(currentJob);
                    bullets = [];
                }

                // Parse new job entry
                const jobData = this.parseJobEntry(line, lines[i + 1] || '');
                currentJob = jobData;
            } else if (line.match(/^[•\-\*]/) || (currentJob && line.length > 10)) {
                // This is a bullet point
                const bullet = line.replace(/^[•\-\*]\s*/, '').trim();
                if (bullet.length > 10) {
                    bullets.push(bullet);
                }
            }
        }

        // Save last job
        if (currentJob) {
            currentJob.bullets = bullets;
            experience.push(currentJob);
        }

        return experience;
    }

    /**
     * Parse individual job entry
     */
    static parseJobEntry(line1, line2) {
        const job = {
            company: '',
            title: '',
            startDate: '',
            endDate: '',
            bullets: []
        };

        // Extract dates
        const dateRegex = /(\w+\s+20\d{2}|20\d{2})\s*[-–—]\s*(\w+\s+20\d{2}|20\d{2}|present|current)/i;
        const dateMatch = (line1 + ' ' + line2).match(dateRegex);
        
        if (dateMatch) {
            job.startDate = dateMatch[1];
            job.endDate = dateMatch[2];
        }

        // Try to extract company and title
        // Common patterns: "Title at Company" or "Company - Title" or "Title | Company"
        const patterns = [
            /^(.+?)\s+at\s+(.+?)(?:\s*\||$)/i,
            /^(.+?)\s*[-–—]\s*(.+?)(?:\s*\||$)/i,
            /^(.+?)\s*\|\s*(.+?)$/i
        ];

        for (const pattern of patterns) {
            const match = line1.match(pattern);
            if (match) {
                job.title = match[1].trim();
                job.company = match[2].trim();
                break;
            }
        }

        // If pattern didn't match, use heuristics
        if (!job.title && !job.company) {
            // Remove dates from line
            const cleanLine = line1.replace(dateRegex, '').trim();
            
            // If line has separator, split on it
            if (cleanLine.includes('|')) {
                const parts = cleanLine.split('|');
                job.title = parts[0].trim();
                job.company = parts[1]?.trim() || '';
            } else if (cleanLine.includes('-')) {
                const parts = cleanLine.split('-');
                job.title = parts[0].trim();
                job.company = parts[1]?.trim() || '';
            } else {
                // Assume whole line is title, company might be on next line
                job.title = cleanLine;
                if (line2 && !line2.match(/^[•\-\*]/) && line2.length < 100) {
                    job.company = line2.replace(dateRegex, '').trim();
                }
            }
        }

        return job;
    }

    /**
     * Extract education
     */
    static extractEducation(text) {
        const education = [];

        // Find education section
        const eduSectionRegex = /(?:education|academic)[:\s]+([\s\S]+?)(?=\n(?:experience|skills|certifications|projects)|$)/i;
        const eduMatch = text.match(eduSectionRegex);

        if (!eduMatch) {
            return education;
        }

        const eduSection = eduMatch[1];
        const lines = eduSection.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let currentEdu = null;

        for (const line of lines) {
            // Check if this is a degree line
            const degreePattern = /(bachelor|master|phd|ph\.d|associate|b\.s|m\.s|b\.a|m\.a|mba)/i;
            const hasDegree = degreePattern.test(line);

            if (hasDegree || (line.length < 100 && !line.match(/^[•\-\*]/))) {
                if (currentEdu) {
                    education.push(currentEdu);
                }

                currentEdu = this.parseEducationEntry(line);
            }
        }

        if (currentEdu) {
            education.push(currentEdu);
        }

        return education;
    }

    /**
     * Parse individual education entry
     */
    static parseEducationEntry(line) {
        const edu = {
            institution: '',
            degree: '',
            field: '',
            graduationDate: ''
        };

        // Extract graduation date
        const dateRegex = /\b(20\d{2}|19\d{2})\b/;
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            edu.graduationDate = dateMatch[0];
        }

        // Extract degree
        const degreeRegex = /(bachelor|master|phd|ph\.d|associate|b\.s|m\.s|b\.a|m\.a|mba)(?:\s+of\s+)?(?:\s+science|\s+arts)?/i;
        const degreeMatch = line.match(degreeRegex);
        if (degreeMatch) {
            edu.degree = degreeMatch[0];
        }

        // Extract field (usually "in [field]")
        const fieldRegex = /\bin\s+([A-Z][a-zA-Z\s]+?)(?:\s*,|\s*-|\s*\||$)/;
        const fieldMatch = line.match(fieldRegex);
        if (fieldMatch) {
            edu.field = fieldMatch[1].trim();
        }

        // Extract institution (usually after degree or at start)
        const cleanLine = line.replace(dateRegex, '').replace(degreeRegex, '').trim();
        const parts = cleanLine.split(/[-,|]/);
        if (parts.length > 0) {
            edu.institution = parts[0].trim();
        }

        return edu;
    }

    /**
     * Extract skills
     */
    static extractSkills(text) {
        const skills = [];

        // Find skills section
        const skillsSectionRegex = /(?:skills|technical skills|core competencies)[:\s]+([\s\S]+?)(?=\n(?:experience|education|certifications|projects)|$)/i;
        const skillsMatch = text.match(skillsSectionRegex);

        if (!skillsMatch) {
            return skills;
        }

        const skillsSection = skillsMatch[1];

        // Skills can be comma-separated, bullet points, or line-separated
        const delimiters = /[,•\-\*\n]/;
        const skillsList = skillsSection.split(delimiters);

        for (const skill of skillsList) {
            const trimmed = skill.trim();
            if (trimmed.length > 1 && trimmed.length < 50) {
                // Remove common prefixes
                const cleaned = trimmed.replace(/^(and|or)\s+/i, '');
                if (cleaned.length > 1) {
                    skills.push(cleaned);
                }
            }
        }

        return skills;
    }

    /**
     * Extract certifications
     */
    static extractCertifications(text) {
        const certifications = [];

        // Find certifications section
        const certSectionRegex = /(?:certifications?|licenses?)[:\s]+([\s\S]+?)(?=\n(?:experience|education|skills|projects)|$)/i;
        const certMatch = text.match(certSectionRegex);

        if (!certMatch) {
            return certifications;
        }

        const certSection = certMatch[1];
        const lines = certSection.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        for (const line of lines) {
            const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
            if (cleaned.length > 5 && cleaned.length < 150) {
                certifications.push(cleaned);
            }
        }

        return certifications;
    }
}

module.exports = ResumeParser;
