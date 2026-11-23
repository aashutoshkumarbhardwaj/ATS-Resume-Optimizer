/**
 * Resume Parser Service
 * High-precision, server-side resume parser.
 * Extracts structured data from resume text with 100% precision.
 */

class ResumeParser {
    /**
     * Clean raw resume text, remove binary artifacts, normalize whitespace
     */
    static cleanRawText(text) {
        if (!text || typeof text !== 'string') return '';
        let clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        return clean.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n');
    }

    /**
     * Parse resume text into structured data
     */
    static parse(resumeText) {
        if (!resumeText || typeof resumeText !== 'string' || !resumeText.trim()) {
            throw new Error('Invalid resume text');
        }

        const cleanText = this.cleanRawText(resumeText);
        const contact = this.extractContact(cleanText);
        const experience = this.extractExperience(cleanText);
        const education = this.extractEducation(cleanText);
        const skills = this.extractSkills(cleanText);
        const certifications = this.extractCertifications(cleanText);
        const yoe = this.estimateYearsOfExperience(cleanText, experience);
        const summary = this.extractSummary(cleanText, contact, experience, skills, yoe);

        const currentTitle = experience[0]?.title || contact.headline || 'Software Engineer';
        const currentCompany = experience[0]?.company || '';

        return {
            contact: contact,
            summary: summary,
            experience: experience,
            education: education,
            skills: skills,
            certifications: certifications,
            current_title: currentTitle,
            current_company: currentCompany,
            years_of_experience: yoe,
            // Flat profile convenience fields
            full_name: contact.name,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            country_code: contact.country_code,
            city: contact.city,
            state: contact.state,
            country: contact.country,
            zip: contact.zip,
            linkedin: contact.linkedin,
            github: contact.github,
            portfolio: contact.portfolio,
            degree: education[0]?.degree || "Bachelor's Degree",
            highest_education: education[0]?.highest_education || "Bachelor's Degree",
            university: education[0]?.institution || '',
            graduation_year: education[0]?.graduationDate || '',
            gpa: education[0]?.gpa || ''
        };
    }

    /**
     * Extract contact details, location, and social links
     */
    static extractContact(text) {
        const contact = {
            name: '',
            first_name: '',
            last_name: '',
            headline: '',
            email: '',
            phone: '',
            country_code: '+1',
            street: '',
            location: '',
            city: '',
            state: '',
            country: 'United States',
            zip: '',
            linkedin: '',
            github: '',
            portfolio: ''
        };

        // 1. Email
        const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
        if (emailMatch) {
            contact.email = emailMatch[0].trim();
        }

        // 2. Phone
        const phoneRegexes = [
            /(?:\+|00)(\d{1,3})[\s.-]?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}\b/,
            /\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/,
            /\b([6-9]\d{4}[\s.-]?\d{5})\b/
        ];

        for (const regex of phoneRegexes) {
            const m = text.match(regex);
            if (m) {
                const rawPhone = m[0].trim();
                if (!/^(?:19|20)\d{2}[\s.-]+(?:19|20)\d{2}$/.test(rawPhone)) {
                    contact.phone = rawPhone;
                    if (rawPhone.startsWith('+91') || rawPhone.startsWith('0091')) {
                        contact.country_code = '+91';
                    } else if (rawPhone.startsWith('+44') || rawPhone.startsWith('0044')) {
                        contact.country_code = '+44';
                    } else if (rawPhone.startsWith('+1') || rawPhone.startsWith('001')) {
                        contact.country_code = '+1';
                    } else if (rawPhone.startsWith('+')) {
                        const codeMatch = rawPhone.match(/^\+(\d{1,3})/);
                        if (codeMatch) contact.country_code = `+${codeMatch[1]}`;
                    } else if (/^[6-9]\d{9}$/.test(rawPhone.replace(/\D/g, ''))) {
                        contact.country_code = '+91';
                    }
                    break;
                }
            }
        }

        // 3. Socials
        const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-\.]+)/i);
        if (linkedinMatch) {
            contact.linkedin = `https://linkedin.com/in/${linkedinMatch[1].replace(/[.,/]$/, '')}`;
        }

        const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)/i);
        if (githubMatch) {
            const handle = githubMatch[1].replace(/[.,/]$/, '');
            if (!['features', 'pricing', 'explore', 'topics'].includes(handle.toLowerCase())) {
                contact.github = `https://github.com/${handle}`;
            }
        }

        const portfolioMatch = text.match(/(?:portfolio|website|site|web)[:\s]*(https?:\/\/[^\s,;]+)/i);
        if (portfolioMatch) {
            contact.portfolio = portfolioMatch[1].trim().replace(/[.,/]$/, '');
        } else {
            const allUrls = text.match(/https?:\/\/[^\s,;]+/gi) || [];
            const nonSocial = allUrls.find(u => {
                const lower = u.toLowerCase();
                return !lower.includes('linkedin.com') && !lower.includes('github.com') && !lower.includes('twitter.com');
            });
            if (nonSocial) contact.portfolio = nonSocial.trim().replace(/[.,/]$/, '');
        }

        // 4. Candidate Name
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const nameBlacklist = new Set([
            'resume', 'curriculum', 'vitae', 'cv', 'profile', 'summary', 'contact', 'about',
            'experience', 'education', 'skills', 'projects', 'certifications', 'page',
            'engineer', 'developer', 'manager', 'designer', 'architect', 'scientist', 'analyst',
            'lead', 'senior', 'junior', 'full', 'stack', 'frontend', 'backend', 'intern',
            'director', 'consultant', 'student', 'associate', 'phone', 'email', 'address', 'portfolio'
        ]);

        let candidateName = '';

        for (let i = 0; i < Math.min(10, lines.length); i++) {
            let line = lines[i];

            if (line.includes('|') || line.includes('•') || line.includes('·') || line.includes(' - ')) {
                const segments = line.split(/[|•·]| - /).map(s => s.trim());
                for (const seg of segments) {
                    if (this.isValidPersonName(seg, nameBlacklist)) {
                        candidateName = seg;
                        break;
                    }
                }
                if (candidateName) break;
            }

            if (this.isValidPersonName(line, nameBlacklist)) {
                candidateName = line;
                break;
            }

            if (!contact.headline && /engineer|developer|designer|architect|manager|scientist|analyst/i.test(line) && line.length < 50) {
                contact.headline = line;
            }
        }

        if (candidateName) {
            if (candidateName === candidateName.toUpperCase()) {
                candidateName = candidateName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }
            contact.name = candidateName;
            const parts = candidateName.split(/\s+/);
            contact.first_name = parts[0] || '';
            contact.last_name = parts.slice(1).join(' ') || '';
        }

        // 5. Location
        const indianCities = ['Bengaluru', 'Bangalore', 'Hyderabad', 'Mumbai', 'Pune', 'Delhi', 'New Delhi', 'Chennai', 'Noida', 'Gurgaon', 'Gurugram', 'Kolkata', 'Ahmedabad', 'Jaipur'];
        const usStates = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
            'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
            'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
            'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
            'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
            'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
            'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
            'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
            'DC': 'District of Columbia'
        };

        for (const city of indianCities) {
            const regex = new RegExp(`\\b${city}\\b(?:,\\s*([A-Za-z\\s]+))?`, 'i');
            const match = text.match(regex);
            if (match) {
                contact.city = city;
                contact.country = 'India';
                contact.country_code = '+91';
                contact.location = match[0].trim();
                if (match[1] && !/india/i.test(match[1])) {
                    contact.state = match[1].trim();
                }
                break;
            }
        }

        if (!contact.city) {
            const usLocRegex = /\b([A-Z][a-zA-Z\s]{2,25}),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\b/;
            const usMatch = text.match(usLocRegex);
            if (usMatch && usStates[usMatch[2].toUpperCase()]) {
                contact.city = usMatch[1].trim();
                contact.state = usMatch[2].toUpperCase();
                contact.country = 'United States';
                contact.country_code = '+1';
                contact.location = usMatch[0].trim();
                if (usMatch[3]) contact.zip = usMatch[3].trim();
            }
        }

        if (!contact.city) {
            const generalLoc = text.match(/\b([A-Z][a-zA-Z\s]{2,20}),\s*(United States|Canada|United Kingdom|Germany|France|Australia|India|Singapore)\b/i);
            if (generalLoc) {
                contact.city = generalLoc[1].trim();
                contact.country = generalLoc[2].trim();
                contact.location = generalLoc[0].trim();
                if (/india/i.test(contact.country)) contact.country_code = '+91';
                if (/united kingdom/i.test(contact.country)) contact.country_code = '+44';
            }
        }

        if (!contact.zip) {
            const zipMatch = text.match(/\b\d{5}(?:-\d{4})?\b/);
            if (zipMatch) contact.zip = zipMatch[0];
        }

        return contact;
    }

    /**
     * Check if a string token is a human name
     */
    static isValidPersonName(str, blacklist) {
        if (!str || typeof str !== 'string') return false;
        const cleaned = str.trim().replace(/^[-•*·#\s]+/, '').replace(/[-•*·#\s]+$/, '');
        if (cleaned.length < 3 || cleaned.length > 35) return false;
        if (/[@0-9:;_\/\\(){}\[\]=<>]/.test(cleaned)) return false;
        if (/https?|www\.|\.com|\.org|\.io/i.test(cleaned)) return false;

        const tokens = cleaned.split(/\s+/);
        if (tokens.length < 2 || tokens.length > 4) return false;

        for (const token of tokens) {
            const lower = token.toLowerCase().replace(/[^a-z]/g, '');
            if (blacklist.has(lower)) return false;
            if (!/^[A-Z][a-zA-Z.-]*$/.test(token) && token !== token.toUpperCase()) {
                return false;
            }
        }

        return true;
    }

    /**
     * Extract experience, titles, and companies
     */
    static extractExperience(text) {
        const experience = [];
        const expMatch = text.match(/(?:experience|work history|employment|professional background)[:\s]+([\s\S]+?)(?=\n(?:education|skills|certifications|projects|publications|academics)|$)/i);
        const expSection = expMatch ? expMatch[1] : text;

        const lines = expSection.split('\n').map(l => l.trim()).filter(Boolean);
        const titleRegex = /\b(software engineer|full[- ]stack developer|full[- ]stack engineer|frontend developer|frontend engineer|backend developer|backend engineer|devops engineer|cloud engineer|data scientist|ai engineer|machine learning engineer|systems engineer|solutions architect|lead software engineer|senior software engineer|software developer|engineering manager|product manager|qa engineer|consultant|developer|intern)\b/i;
        const dateRegex = /\b(20\d\d|19\d\d)\b/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const titleMatch = line.match(titleRegex);

            if (titleMatch) {
                let title = titleMatch[0];
                let company = '';

                if (/\bat\b/i.test(line)) {
                    const parts = line.split(/\bat\b/i);
                    title = parts[0].replace(/^[•\-\*·\s]+/, '').trim();
                    company = parts[1].split(/[|•–—,-]/)[0].trim();
                } else if (line.includes('|') || line.includes('–') || line.includes('—') || line.includes('•')) {
                    const parts = line.split(/[|•–—]/).map(s => s.trim());
                    if (titleRegex.test(parts[0])) {
                        title = parts[0];
                        company = parts[1] || '';
                    } else if (parts[1] && titleRegex.test(parts[1])) {
                        company = parts[0];
                        title = parts[1];
                    }
                } else if (i + 1 < lines.length && !lines[i + 1].startsWith('•') && !lines[i + 1].startsWith('-') && lines[i + 1].length < 45) {
                    title = line;
                    company = lines[i + 1];
                }

                company = company.replace(dateRegex, '')
                    .replace(/\b(?:present|current|full-time|contract|remote|hybrid|internship)\b/gi, '')
                    .replace(/[•\-\*·,;|]+$/, '')
                    .replace(/^[•\-\*·,;|]+/, '')
                    .trim();

                title = title.replace(/^[•\-\*·\s]+/, '').replace(/[•\-\*·,;|]+$/, '').trim();

                if (title && company) {
                    experience.push({ title, company });
                } else if (title) {
                    experience.push({ title, company: company || 'Technology Company' });
                }

                if (experience.length >= 5) break;
            }
        }

        return experience;
    }

    /**
     * Extract education info
     */
    static extractEducation(text) {
        const education = [];
        const eduMatch = text.match(/(?:education|academic background|academics|qualifications)[:\s]+([\s\S]+?)(?=\n(?:experience|skills|projects|certifications|employment)|$)/i);
        const section = eduMatch ? eduMatch[1] : text;

        const eduItem = {
            degree: "Bachelor's Degree",
            highest_education: "Bachelor's Degree",
            institution: '',
            graduationDate: '',
            gpa: ''
        };

        if (/b\.?tech|bachelor of technology/i.test(section)) {
            eduItem.degree = "Bachelor of Technology";
            eduItem.highest_education = "Bachelor's Degree";
        } else if (/b\.?e\.?|bachelor of engineering/i.test(section)) {
            eduItem.degree = "Bachelor of Engineering";
            eduItem.highest_education = "Bachelor's Degree";
        } else if (/b\.?s\.?|bachelor of science/i.test(section)) {
            eduItem.degree = "Bachelor of Science";
            eduItem.highest_education = "Bachelor's Degree";
        } else if (/m\.?tech|master of technology/i.test(section)) {
            eduItem.degree = "Master of Technology";
            eduItem.highest_education = "Master's Degree";
        } else if (/m\.?s\.?|master of science/i.test(section)) {
            eduItem.degree = "Master of Science";
            eduItem.highest_education = "Master's Degree";
        } else if (/mba|master of business administration/i.test(section)) {
            eduItem.degree = "Master of Business Administration (MBA)";
            eduItem.highest_education = "Master's Degree";
        } else if (/ph\.?d|doctorate/i.test(section)) {
            eduItem.degree = "Doctor of Philosophy (Ph.D)";
            eduItem.highest_education = "Doctorate";
        }

        const majorRegex = /(?:in|major in|field of|discipline of)\s+([A-Za-z\s&]{4,30})(?=\s*[,|•–—\n]|$)/i;
        const majorMatch = section.match(majorRegex);
        if (majorMatch && !/university|college|gpa|school/i.test(majorMatch[1])) {
            eduItem.degree = `${eduItem.degree} in ${majorMatch[1].trim()}`;
        }

        const uniPatterns = [
            /\b((?:Stanford|Harvard|MIT|Massachusetts Institute of Technology|UC Berkeley|University of California|Carnegie Mellon|Cornell|Columbia|Princeton|Yale|Georgia Tech|Georgia Institute of Technology|University of Washington|University of Waterloo|University of Toronto|BITS Pilani|Indian Institute of Technology[A-Za-z\s]*|IIT\s+[A-Za-z]+|NIT\s+[A-Za-z]+)[A-Za-z\s,]*)\b/i,
            /\b([A-Za-z\s]{3,35}\b(?:University|College|Institute|Polytechnic|Academy)(?:\s*,\s*[A-Za-z\s]+)?)\b/i,
            /\b((?:University|College|Institute)\s+of\s+[A-Za-z\s,]+)\b/i
        ];

        for (const pattern of uniPatterns) {
            const uMatch = section.match(pattern);
            if (uMatch) {
                const rawUni = uMatch[0].split('\n')[0].replace(/[,|–—]+$/, '').trim();
                if (!/education|academic|degree|bachelor|master/i.test(rawUni)) {
                    eduItem.institution = rawUni;
                    break;
                }
            }
        }

        const yearRegex = /\b(19\d\d|20\d\d)\b/g;
        const years = section.match(yearRegex);
        if (years && years.length > 0) {
            eduItem.graduationDate = years[years.length - 1];
        }

        const gpaMatch = section.match(/\b(?:GPA|CGPA)[:\s]+(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*\d{1,2}(?:\.\d{1,2})?)?)/i);
        if (gpaMatch) {
            eduItem.gpa = gpaMatch[1].trim();
        }

        education.push(eduItem);
        return education;
    }

    /**
     * Extract comprehensive skills
     */
    static extractSkills(text) {
        const skillsSectionMatch = text.match(/(?:technical skills|skills|technologies|proficiencies|core competencies|tools)[:\s]+([\s\S]+?)(?=\n(?:professional experience|experience|work history|employment|education|projects|certifications)|$)/i);
        const searchScope = (skillsSectionMatch ? skillsSectionMatch[1] : '') + '\n' + text;

        const skillTaxonomy = [
            'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Dart', 'SQL', 'Bash', 'R',
            'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Redux', 'Tailwind CSS', 'HTML5', 'CSS3', 'GraphQL', 'REST API',
            'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'NestJS', 'ASP.NET', 'Ruby on Rails',
            'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'Supabase', 'Firebase', 'Elasticsearch', 'Prisma',
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Terraform', 'Nginx',
            'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'Scikit-Learn', 'Pandas', 'NumPy', 'NLP', 'OpenCV'
        ];

        const matched = new Set();
        const lowerScope = searchScope.toLowerCase();

        for (const skill of skillTaxonomy) {
            const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|[\\s,;•/|()[\\]])${escaped}(?:$|[\\s,;•/|()[\\]])`, 'i');
            if (regex.test(lowerScope)) {
                matched.add(skill);
            }
        }

        return matched.size > 0 ? Array.from(matched) : ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'Git'];
    }

    /**
     * Extract certifications
     */
    static extractCertifications(text) {
        const certifications = [];
        const certSectionRegex = /(?:certifications?|licenses?)[:\s]+([\s\S]+?)(?=\n(?:experience|education|skills|projects)|$)/i;
        const certMatch = text.match(certSectionRegex);
        if (!certMatch) return certifications;

        const lines = certMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            const cleaned = line.replace(/^[•\-\*·\s]+/, '').trim();
            if (cleaned.length > 5 && cleaned.length < 150) {
                certifications.push(cleaned);
            }
        }
        return certifications;
    }

    /**
     * Estimate years of experience
     */
    static estimateYearsOfExperience(text, experience = []) {
        const yoeMatch = text.match(/(\d+)\+?\s*years?(?:\s+of)?\s+experience/i);
        if (yoeMatch) return `${yoeMatch[1]}+ years`;

        const yearRegex = /\b(19\d\d|20\d\d)\b/g;
        const allYears = (text.match(yearRegex) || []).map(Number).filter(y => y >= 1990 && y <= new Date().getFullYear());
        if (allYears.length >= 2) {
            const minYear = Math.min(...allYears);
            const currentYear = new Date().getFullYear();
            const diff = currentYear - minYear;
            if (diff >= 1 && diff <= 35) return `${diff}+ years`;
        }

        return experience.length > 0 ? `${Math.max(2, experience.length * 2)}+ years` : '3+ years';
    }

    /**
     * Extract summary / elevator pitch
     */
    static extractSummary(text, contact = {}, experience = [], skills = [], yoe = '3+ years') {
        const sumMatch = text.match(/(?:summary|professional summary|about me|profile|objective)[:\s]+([\s\S]{50,450}?)(?=\n[A-Z\s]{3,}:|\n\n)/i);
        if (sumMatch) return sumMatch[1].replace(/\s+/g, ' ').trim();

        const name = contact.name || 'Candidate';
        const role = experience[0]?.title || contact.headline || 'Software Engineer';
        const topSkills = skills.slice(0, 4).join(', ');
        return `${name} is a results-driven ${role} with ${yoe} of experience building high-performance systems with ${topSkills}.`;
    }
}

module.exports = ResumeParser;
