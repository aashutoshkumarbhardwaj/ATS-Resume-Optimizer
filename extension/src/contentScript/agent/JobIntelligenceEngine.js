/**
 * Job Intelligence & Explainable Suitability Engine (Phases 3 & 4)
 * 1. Multi-strategy structured Job Description extraction (required vs preferred skills,
 *    experience requirements, responsibilities, location, seniority, salary).
 * 2. Explainable Candidate Suitability evaluation with evidence provenance,
 *    partial/missing requirements, rejection risks, and Apply/Stretch/Skip recommendation.
 */
class JobIntelligenceEngine {
    static SKILL_CATALOG = [
        'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'SQL', 'NoSQL',
        'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Spring Boot',
        'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Supabase', 'Firebase',
        'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Git', 'Linux',
        'Machine Learning', 'Deep Learning', 'NLP', 'LLM', 'RAG', 'PyTorch', 'TensorFlow', 'Scikit-learn',
        'LangChain', 'Hugging Face', 'Computer Vision', 'REST API', 'GraphQL', 'Microservices', 'System Design',
        'Data Structures', 'Algorithms', 'HTML', 'CSS', 'Tailwind CSS', 'Playwright', 'Selenium', 'Jest'
    ];

    /**
     * Extract structured job representation from raw JD text + optional DOM/metadata
     */
    static extractStructuredJob(rawText = '', meta = {}) {
        const text = String(rawText || '').trim();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

        // 1. Identify sections (requirements vs preferred vs responsibilities)
        const sections = {
            required: [],
            preferred: [],
            responsibilities: [],
            education: [],
            other: []
        };

        let currentBucket = 'other';
        for (const line of lines) {
            const lower = line.toLowerCase();
            if (/^(preferred|nice to have|bonus|plus|good to have|desired|optional)\b/.test(lower)) {
                currentBucket = 'preferred';
                continue;
            }
            if (/^(requirements|required|must have|minimum qualifications|basic qualifications|what we(?:'re| are) looking for|who you are|qualifications)\b/.test(lower)) {
                currentBucket = 'required';
                continue;
            }
            if (/^(responsibilities|what you(?:'ll| will) do|role|duties|key responsibilities|in this role)\b/.test(lower)) {
                currentBucket = 'responsibilities';
                continue;
            }
            if (/^(education|academic)\b/.test(lower)) {
                currentBucket = 'education';
                continue;
            }
            sections[currentBucket].push(line);
        }

        const extractSkillsFromText = (str) => {
            const found = [];
            for (const skill of this.SKILL_CATALOG) {
                const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
                if (regex.test(str)) {
                    found.push(skill);
                }
            }
            return Array.from(new Set(found));
        };

        const reqText = sections.required.join('\n') || text;
        const prefText = sections.preferred.join('\n');

        let requiredSkills = extractSkillsFromText(reqText);
        let preferredSkills = extractSkillsFromText(prefText).filter((s) => !requiredSkills.includes(s));

        // If no explicit sections existed, check inline "preferred/nice to have/plus" sentences
        if (sections.required.length === 0 && sections.preferred.length === 0) {
            const allSkills = extractSkillsFromText(text);
            const prefSentences = lines.filter((l) => /\b(preferred|nice to have|bonus|plus|familiarity with)\b/i.test(l)).join('\n');
            preferredSkills = extractSkillsFromText(prefSentences);
            requiredSkills = allSkills.filter((s) => !preferredSkills.includes(s));
        }

        // 2. Experience extraction (e.g. "0-2 years", "3+ years", "Fresher / Intern")
        let experience = meta.experience || '';
        const expMatch = text.match(/(\d+\s*(?:\+|[-–to]+\s*\d+)?\s*years?(?:\s+of)?\s+(?:experience|exp))/i);
        if (expMatch) {
            experience = expMatch[1].replace(/\s+/g, ' ').trim();
        } else if (/\b(intern|internship|fresher|entry[\s-]?level|new grad)\b/i.test(meta.role || text)) {
            experience = '0-1 years (Entry / Intern)';
        }

        // 3. Seniority inference
        const roleStr = (meta.role || meta.jobTitle || lines[0] || 'Software Role').trim();
        let seniority = 'Mid-Level';
        if (/\b(intern|internship|trainee|apprentice)\b/i.test(roleStr)) seniority = 'Intern';
        else if (/\b(junior|jr\.?|entry|associate|graduate|sde[\s-]?1|l3)\b/i.test(roleStr)) seniority = 'Entry / Junior';
        else if (/\b(staff|principal|architect|director|vp|head of|lead)\b/i.test(roleStr)) seniority = 'Staff / Lead';
        else if (/\b(senior|sr\.?|sde[\s-]?2|sde[\s-]?3|l5|l6)\b/i.test(roleStr)) seniority = 'Senior';

        // 4. Location & Employment Type
        let location = meta.location || '';
        if (!location) {
            const locMatch = text.match(/\b(?:location|based in|office)\s*[:\-]\s*([A-Za-z0-9,\s/-]{2,50})/i);
            if (locMatch) location = locMatch[1].split('\n')[0].trim();
            else if (/\bremote\b/i.test(text)) location = 'Remote';
        }

        let employmentType = meta.employmentType || 'Full-Time';
        if (/\bintern(?:ship)?\b/i.test(roleStr + ' ' + text.slice(0, 300))) employmentType = 'Internship';
        else if (/\bcontract\b/i.test(text.slice(0, 400))) employmentType = 'Contract';
        else if (/\bpart[\s-]?time\b/i.test(text.slice(0, 400))) employmentType = 'Part-Time';

        // 5. Education & Salary
        const eduMatches = text.match(/\b(b\.?tech|b\.?e\.?|bachelor(?:'s)?|master(?:'s)?|m\.?tech|ms|bs|computer science|engineering)\b/gi) || [];
        const educationRequirements = Array.from(new Set(eduMatches.map((e) => e.trim())));

        const salaryMatch = text.match(/(?:\$|₹|INR|USD)\s*\d[\d,.]*(?:\s*[kKlL])?(?:\s*[-–to]+\s*(?:\$|₹|INR|USD)?\s*\d[\d,.]*(?:\s*[kKlL])?)?(?:\s*(?:per\s*(?:annum|year|month|hour)|\/yr|\/hr|LPA))?/i);

        return {
            role: roleStr,
            company: meta.company || 'Unknown Company',
            location: location || 'Not specified',
            employment_type: employmentType,
            experience: experience || 'Not specified',
            seniority,
            required_skills: requiredSkills,
            preferred_skills: preferredSkills,
            responsibilities: sections.responsibilities.slice(0, 8),
            education_requirements: educationRequirements,
            salary: salaryMatch ? salaryMatch[0].trim() : null,
            rawLength: text.length
        };
    }

    /**
     * Build an evidence map for candidate skills/experience from structured profile + resume
     */
    static buildCandidateEvidence(profile = {}, resumeData = {}) {
        const evidenceMap = new Map(); // canonicalLower -> { skill, sources: [] }

        const addEvidence = (rawText, sourceLabel) => {
            if (!rawText) return;
            const str = Array.isArray(rawText) ? rawText.join(', ') : String(rawText);
            for (const skill of this.SKILL_CATALOG) {
                const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
                if (regex.test(str)) {
                    const key = skill.toLowerCase();
                    if (!evidenceMap.has(key)) evidenceMap.set(key, { skill, sources: new Set() });
                    evidenceMap.get(key).sources.add(sourceLabel);
                }
            }
        };

        addEvidence(profile.skills, 'manual_profile');
        addEvidence(resumeData.skills, 'resume');
        addEvidence(resumeData.rawText || profile.resumeText, 'resume');

        if (Array.isArray(resumeData.projects)) {
            for (const proj of resumeData.projects) {
                addEvidence(typeof proj === 'string' ? proj : `${proj.name || ''} ${proj.description || ''} ${(proj.technologies || []).join(' ')}`, 'project');
            }
        }
        if (Array.isArray(resumeData.experience)) {
            for (const exp of resumeData.experience) {
                addEvidence(typeof exp === 'string' ? exp : `${exp.title || ''} ${(exp.bullets || []).join(' ')}`, 'work_experience');
            }
        }
        return evidenceMap;
    }

    /**
     * Parse numeric years from an experience string like "0-2 years" or "3+ years"
     */
    static parseMinYears(expStr = '') {
        const m = String(expStr).match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    }

    /**
     * Explainable Job Suitability Evaluation (Phase 4)
     */
    static evaluateSuitability(structuredJob, profile = {}, resumeData = {}) {
        const evidenceMap = this.buildCandidateEvidence(profile, resumeData);
        const reqSkills = structuredJob.required_skills || [];
        const prefSkills = structuredJob.preferred_skills || [];

        const strongMatches = [];
        const missingRequirements = [];
        const evidence = [];

        for (const skill of reqSkills) {
            const hit = evidenceMap.get(skill.toLowerCase());
            if (hit) {
                strongMatches.push(skill);
                evidence.push({ skill, type: 'required', sources: Array.from(hit.sources) });
            } else {
                missingRequirements.push(skill);
            }
        }

        const partialMatches = [];
        for (const skill of prefSkills) {
            const hit = evidenceMap.get(skill.toLowerCase());
            if (hit) {
                partialMatches.push(skill);
                evidence.push({ skill, type: 'preferred', sources: Array.from(hit.sources) });
            }
        }

        const reqCoverage = reqSkills.length > 0 ? strongMatches.length / reqSkills.length : 1;
        const prefCoverage = prefSkills.length > 0 ? partialMatches.length / prefSkills.length : 1;

        // Experience & seniority check
        const candYears = parseFloat(profile.years_of_experience ?? profile.yearsOfExperience ?? 0) || 0;
        const minReqYears = this.parseMinYears(structuredJob.experience);
        let expScore = 1;
        const rejectionRisks = [];

        if (minReqYears > 0 && candYears < minReqYears) {
            const gap = minReqYears - candYears;
            expScore = Math.max(0.25, 1 - gap * 0.25);
            rejectionRisks.push(`Requires ${structuredJob.experience}, while profile lists ${candYears} years.`);
        }
        if (structuredJob.seniority === 'Senior' || structuredJob.seniority === 'Staff / Lead') {
            if (candYears < 3) {
                rejectionRisks.push(`Seniority mismatch: role is ${structuredJob.seniority}.`);
            }
        }

        // Location compatibility
        let locScore = 1;
        const jobLoc = (structuredJob.location || '').toLowerCase();
        const candCity = (profile.city || '').toLowerCase();
        const willingRelocate = (profile.relocate || 'Yes').toLowerCase();
        if (jobLoc && jobLoc !== 'not specified' && !jobLoc.includes('remote') && candCity && !jobLoc.includes(candCity)) {
            if (willingRelocate === 'no' || willingRelocate === 'remote only') {
                locScore = 0.4;
                rejectionRisks.push(`Location mismatch: job is in ${structuredJob.location}, candidate prefers ${profile.city || 'Remote'}.`);
            } else {
                locScore = 0.85;
            }
        }

        if (missingRequirements.length > 0) {
            rejectionRisks.push(`Missing required skills: ${missingRequirements.slice(0, 5).join(', ')}.`);
        }

        // Weighted explainable score
        const overallScore = Math.round(
            (reqCoverage * 55) +
            (prefCoverage * 15) +
            (expScore * 20) +
            (locScore * 10)
        );

        let recommendation = 'STRONG_APPLY';
        if (overallScore < 45 || (reqCoverage < 0.35 && reqSkills.length >= 3)) {
            recommendation = 'SKIP';
        } else if (overallScore < 65) {
            recommendation = 'STRETCH';
        } else if (overallScore < 80) {
            recommendation = 'APPLY';
        }

        return {
            overallScore,
            recommendation,
            breakdown: {
                requiredSkillCoverage: Math.round(reqCoverage * 100),
                preferredSkillCoverage: Math.round(prefCoverage * 100),
                experienceAlignment: Math.round(expScore * 100),
                locationCompatibility: Math.round(locScore * 100)
            },
            strongMatches,
            partialMatches,
            missingRequirements,
            evidence,
            rejectionRisks
        };
    }
}

if (typeof window !== 'undefined') {
    window.JobIntelligenceEngine = JobIntelligenceEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JobIntelligenceEngine;
}
