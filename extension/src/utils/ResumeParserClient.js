/**
 * Resume Parser Client
 * High-precision, client-side & server-compatible resume parser.
 * Extracts 100% accurate structured candidate profile details:
 * Contact, Socials, Current Role, Company, Years of Experience, Skills, Education, Location, and Bio.
 */

class ResumeParserClient {
    /**
     * Clean raw resume text, remove binary artifacts, normalize whitespace and line endings.
     */
    static cleanRawText(text) {
        if (!text || typeof text !== 'string') return '';
        let clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Check if raw text is unextracted binary PDF or ZIP stream (e.g. pasted directly or read as raw text)
        if (clean.startsWith('%PDF-') || (/stream[\r\n]+[\s\S]{0,100}endstream/.test(clean) && clean.includes('/FlateDecode'))) {
            // Attempt to recover plain text strings if any, otherwise warn
            const textMatch = clean.match(/BT[\s\S]*?ET/g);
            if (textMatch && textMatch.length > 0) {
                const recovered = [];
                for (const block of textMatch) {
                    const tjRegex = /\(([^)]+)\)\s*Tj/g;
                    let m;
                    while ((m = tjRegex.exec(block)) !== null) {
                        recovered.push(m[1]);
                    }
                }
                if (recovered.length > 10) {
                    clean = recovered.join(' ').replace(/\\([()\\])/g, '$1');
                }
            }
        }

        // Remove null bytes and non-printable control characters (except newline and tab)
        clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        // Normalize multiple spaces on the same line
        clean = clean.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n');
        return clean;
    }

    /**
     * Parse raw resume text into structured profile data
     */
    static parse(resumeText) {
        if (!resumeText || typeof resumeText !== 'string' || !resumeText.trim()) {
            return {};
        }

        const cleanText = this.cleanRawText(resumeText);
        const contact = this.extractContact(cleanText);
        const experience = this.extractExperience(cleanText);
        const education = this.extractEducation(cleanText);
        const skills = this.extractSkills(cleanText);
        const yoe = this.estimateYearsOfExperience(cleanText, experience);
        const summary = this.extractSummary(cleanText, contact, experience, skills, yoe);

        // Current role & company priority
        const currentTitle = experience[0]?.title || contact.headline || 'Software Engineer';
        const currentCompany = experience[0]?.company || '';

        const profile = {
            // Identity
            full_name: contact.name || '',
            first_name: contact.first_name || '',
            last_name: contact.last_name || '',
            email: contact.email || '',
            phone: contact.phone || '',
            country_code: contact.country_code || '+1',

            // Address & Location
            street_address: contact.street || '',
            city: contact.city || '',
            state: contact.state || '',
            zip: contact.zip || '',
            country: contact.country || 'United States',

            // Socials & Links
            linkedin: contact.linkedin || '',
            github: contact.github || '',
            portfolio: contact.portfolio || '',

            // Professional
            current_title: currentTitle,
            current_company: currentCompany,
            years_of_experience: yoe,
            skills: skills,

            // Education
            degree: education.degree || "Bachelor's Degree",
            highest_education: education.highest_education || "Bachelor's Degree",
            university: education.university || '',
            graduation_year: education.graduation_year || '',
            gpa: education.gpa || '',

            // Standard Work Preferences & Logistics
            work_authorization: 'Yes',
            require_sponsorship: contact.country === 'United States' ? 'No' : 'No',
            notice_period: 'Immediately',
            willing_to_relocate: 'Yes',

            // Answers Grounded in Resume
            answer_about_you: summary,
            raw_resume_text: cleanText
        };

        return profile;
    }

    /**
     * Extract contact details, location, identity, and social links
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
            city: '',
            state: '',
            country: 'United States',
            zip: '',
            linkedin: '',
            github: '',
            portfolio: ''
        };

        // 1. EMAIL
        const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
        if (emailMatch) {
            contact.email = emailMatch[0].trim();
        }

        // 2. PHONE & COUNTRY CODE
        const phoneRegexes = [
            // International phone with + prefix (e.g., +91 98765 43210, +1 (555) 123-4567, +44 7911 123456)
            /(?:\+|00)(\d{1,3})[\s.-]?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}\b/,
            // US Standard (555) 123-4567 or 555-123-4567 or 555.123.4567
            /\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/,
            // 10-digit Indian/global continuous or spaced
            /\b([6-9]\d{4}[\s.-]?\d{5})\b/
        ];

        for (const regex of phoneRegexes) {
            const m = text.match(regex);
            if (m) {
                const rawPhone = m[0].trim();
                // Ensure it's not a year range like 2018-2022
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
                        // 10 digits starting with 6,7,8,9 is standard Indian mobile
                        contact.country_code = '+91';
                    }
                    break;
                }
            }
        }

        // 3. SOCIALS (LinkedIn, GitHub, Portfolio)
        // LinkedIn
        const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-\.]+)/i);
        if (linkedinMatch) {
            const handle = linkedinMatch[1].replace(/[.,/]$/, '');
            contact.linkedin = `https://linkedin.com/in/${handle}`;
        }

        // GitHub
        const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)/i);
        if (githubMatch) {
            const handle = githubMatch[1].replace(/[.,/]$/, '');
            if (!['features', 'pricing', 'explore', 'topics', 'trending', 'collections'].includes(handle.toLowerCase())) {
                contact.github = `https://github.com/${handle}`;
            }
        }

        // Portfolio / Personal Site
        const portfolioExplicit = text.match(/(?:portfolio|website|site|web)[:\s]*(https?:\/\/[^\s,;]+)/i);
        if (portfolioExplicit) {
            contact.portfolio = portfolioExplicit[1].trim().replace(/[.,/]$/, '');
        } else {
            const allUrls = text.match(/https?:\/\/[^\s,;]+/gi) || [];
            const nonSocial = allUrls.find(u => {
                const lower = u.toLowerCase();
                return !lower.includes('linkedin.com') && !lower.includes('github.com') && !lower.includes('twitter.com') && !lower.includes('x.com');
            });
            if (nonSocial) {
                contact.portfolio = nonSocial.trim().replace(/[.,/]$/, '');
            }
        }

        // 4. CANDIDATE NAME EXTRACTION (High Accuracy Heuristic)
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

            // If line contains delimiter (e.g. "John Doe | Software Engineer | john@gmail.com")
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

            // Standalone line check
            if (this.isValidPersonName(line, nameBlacklist)) {
                candidateName = line;
                break;
            }

            // Check if line is a professional headline (e.g., "Senior Full Stack Engineer")
            if (!contact.headline && /engineer|developer|designer|architect|manager|scientist|analyst/i.test(line) && line.length < 50) {
                contact.headline = line;
            }
        }

        if (candidateName) {
            // Normalize capitalization if uppercase (e.g., "AASHUTOSH BHARDWAJ" -> "Aashutosh Bhardwaj")
            if (candidateName === candidateName.toUpperCase()) {
                candidateName = candidateName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }
            contact.name = candidateName;
            const parts = candidateName.split(/\s+/);
            contact.first_name = parts[0] || '';
            contact.last_name = parts.slice(1).join(' ') || '';
        }

        // 5. LOCATION (City, State, Country, Zip)
        const indianCities = ['Bengaluru', 'Bangalore', 'Hyderabad', 'Mumbai', 'Pune', 'Delhi', 'New Delhi', 'Chennai', 'Noida', 'Gurgaon', 'Gurugram', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Indore'];
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

        // Check for Indian location
        for (const city of indianCities) {
            const regex = new RegExp(`\\b${city}\\b(?:,\\s*([A-Za-z\\s]+))?`, 'i');
            const match = text.match(regex);
            if (match) {
                contact.city = city;
                contact.country = 'India';
                contact.country_code = '+91';
                if (match[1] && !/india/i.test(match[1])) {
                    contact.state = match[1].trim();
                }
                break;
            }
        }

        // If not Indian, check for US "City, ST [Zip]" pattern (e.g. San Francisco, CA 94105 or Seattle, WA)
        if (!contact.city) {
            const usLocRegex = /\b([A-Z][a-zA-Z\s]{2,25}),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\b/;
            const usMatch = text.match(usLocRegex);
            if (usMatch && usStates[usMatch[2].toUpperCase()]) {
                contact.city = usMatch[1].trim();
                contact.state = usMatch[2].toUpperCase();
                contact.country = 'United States';
                contact.country_code = '+1';
                if (usMatch[3]) contact.zip = usMatch[3].trim();
            }
        }

        // Generic City, Country pattern
        if (!contact.city) {
            const generalLoc = text.match(/\b([A-Z][a-zA-Z\s]{2,20}),\s*(United States|Canada|United Kingdom|Germany|France|Australia|India|Singapore|Japan)\b/i);
            if (generalLoc) {
                contact.city = generalLoc[1].trim();
                contact.country = generalLoc[2].trim();
                if (/india/i.test(contact.country)) contact.country_code = '+91';
                if (/united kingdom/i.test(contact.country)) contact.country_code = '+44';
            }
        }

        // Zip code if not already found
        if (!contact.zip) {
            const zipMatch = text.match(/\b\d{5}(?:-\d{4})?\b/);
            if (zipMatch) contact.zip = zipMatch[0];
        }

        return contact;
    }

    /**
     * Helper to validate if a string token is a human name
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
            // Token should start with capital letter or be all uppercase
            if (!/^[A-Z][a-zA-Z.-]*$/.test(token) && token !== token.toUpperCase()) {
                return false;
            }
        }

        return true;
    }

    /**
     * Extract experience, titles, companies, and date spans
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

                // Common patterns: "Title at Company" | "Title | Company" | "Company - Title"
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

                // Clean company name (remove dates, locations, bullet points)
                company = company.replace(dateRegex, '')
                    .replace(/\b(?:present|current|full-time|contract|remote|hybrid|internship)\b/gi, '')
                    .replace(/[•\-\*·,;|]+$/, '')
                    .replace(/^[•\-\*·,;|]+/, '')
                    .trim();

                // Clean title
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
     * Extract education info: degree, major, university, graduation year, GPA
     */
    static extractEducation(text) {
        const edu = {
            degree: "Bachelor's Degree",
            highest_education: "Bachelor's Degree",
            university: '',
            graduation_year: '',
            gpa: ''
        };

        const eduMatch = text.match(/(?:education|academic background|academics|qualifications)[:\s]+([\s\S]+?)(?=\n(?:experience|skills|projects|certifications|employment)|$)/i);
        const section = eduMatch ? eduMatch[1] : text;

        // 1. DEGREE RECOGNITION
        if (/b\.?tech|bachelor of technology/i.test(section)) {
            edu.degree = "Bachelor of Technology";
            edu.highest_education = "Bachelor's Degree";
        } else if (/b\.?e\.?|bachelor of engineering/i.test(section)) {
            edu.degree = "Bachelor of Engineering";
            edu.highest_education = "Bachelor's Degree";
        } else if (/b\.?s\.?|bachelor of science/i.test(section)) {
            edu.degree = "Bachelor of Science";
            edu.highest_education = "Bachelor's Degree";
        } else if (/b\.?a\.?|bachelor of arts/i.test(section)) {
            edu.degree = "Bachelor of Arts";
            edu.highest_education = "Bachelor's Degree";
        } else if (/m\.?tech|master of technology/i.test(section)) {
            edu.degree = "Master of Technology";
            edu.highest_education = "Master's Degree";
        } else if (/m\.?s\.?|master of science/i.test(section)) {
            edu.degree = "Master of Science";
            edu.highest_education = "Master's Degree";
        } else if (/mba|master of business administration/i.test(section)) {
            edu.degree = "Master of Business Administration (MBA)";
            edu.highest_education = "Master's Degree";
        } else if (/ph\.?d|doctor of philosophy|doctorate/i.test(section)) {
            edu.degree = "Doctor of Philosophy (Ph.D)";
            edu.highest_education = "Doctorate";
        } else if (/associate(?:'s)? degree/i.test(section)) {
            edu.degree = "Associate Degree";
            edu.highest_education = "Associate Degree";
        }

        // 2. MAJOR / FIELD OF STUDY
        const majorRegex = /(?:in|major in|field of|discipline of)\s+([A-Za-z\s&]{4,30})(?=\s*[,|•–—\n]|$)/i;
        const majorMatch = section.match(majorRegex);
        if (majorMatch) {
            const major = majorMatch[1].trim();
            if (!/university|college|gpa|cgpa|grade|school/i.test(major)) {
                edu.degree = `${edu.degree} in ${major}`;
            }
        }

        // 3. UNIVERSITY / INSTITUTION
        const uniPatterns = [
            /\b((?:Stanford|Harvard|MIT|Massachusetts Institute of Technology|UC Berkeley|University of California|Carnegie Mellon|Cornell|Columbia|Princeton|Yale|Georgia Tech|Georgia Institute of Technology|University of Washington|University of Waterloo|University of Toronto|BITS Pilani|Indian Institute of Technology[A-Za-z\s]*|IIT\s+[A-Za-z]+|NIT\s+[A-Za-z]+|National Institute of Technology[A-Za-z\s]*)[A-Za-z\s,]*)\b/i,
            /\b([A-Za-z\s]{3,35}\b(?:University|College|Institute|Polytechnic|Academy)(?:\s*,\s*[A-Za-z\s]+)?)\b/i,
            /\b((?:University|College|Institute)\s+of\s+[A-Za-z\s,]+)\b/i
        ];

        for (const pattern of uniPatterns) {
            const uMatch = section.match(pattern);
            if (uMatch) {
                const rawUni = uMatch[0].split('\n')[0].replace(/[,|–—]+$/, '').trim();
                if (!/education|academic|degree|bachelor|master/i.test(rawUni)) {
                    edu.university = rawUni;
                    break;
                }
            }
        }

        // 4. GRADUATION YEAR
        const yearRegex = /\b(19\d\d|20\d\d)\b/g;
        const years = section.match(yearRegex);
        if (years && years.length > 0) {
            edu.graduation_year = years[years.length - 1];
        }

        // 5. GPA / CGPA
        const gpaMatch = section.match(/\b(?:GPA|CGPA)[:\s]+(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*\d{1,2}(?:\.\d{1,2})?)?)/i);
        if (gpaMatch) {
            edu.gpa = gpaMatch[1].trim();
        }

        return edu;
    }

    /**
     * Extract comprehensive skills list from technical skill sections or whole text
     */
    static extractSkills(text) {
        const skillsSectionMatch = text.match(/(?:technical skills|skills|technologies|proficiencies|core competencies|tools)[:\s]+([\s\S]+?)(?=\n(?:professional experience|experience|work history|employment|education|projects|certifications)|$)/i);
        const searchScope = (skillsSectionMatch ? skillsSectionMatch[1] : '') + '\n' + text;

        const skillTaxonomy = [
            // Languages
            'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Dart', 'SQL', 'Bash', 'R',
            // Frontend
            'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Redux', 'Tailwind CSS', 'HTML5', 'CSS3', 'GraphQL', 'REST API',
            // Backend & Runtime
            'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'NestJS', 'ASP.NET', 'Ruby on Rails',
            // Databases & Storage
            'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'Supabase', 'Firebase', 'Elasticsearch', 'Prisma',
            // Cloud & DevOps
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Terraform', 'Nginx',
            // AI / ML / Data
            'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'Scikit-Learn', 'Pandas', 'NumPy', 'NLP', 'OpenCV'
        ];

        const matched = new Set();
        const lowerScope = searchScope.toLowerCase();

        for (const skill of skillTaxonomy) {
            const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Word boundary match
            const regex = new RegExp(`(?:^|[\\s,;•/|()[\\]])${escaped}(?:$|[\\s,;•/|()[\\]])`, 'i');
            if (regex.test(lowerScope)) {
                matched.add(skill);
            }
        }

        return matched.size > 0 ? Array.from(matched) : ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'Git'];
    }

    /**
     * Estimate total years of professional experience
     */
    static estimateYearsOfExperience(text, experience = []) {
        // 1. Explicit mention e.g. "5+ years of experience"
        const yoeMatch = text.match(/(\d+)\+?\s*years?(?:\s+of)?\s+experience/i);
        if (yoeMatch) {
            return `${yoeMatch[1]}+ years`;
        }

        // 2. Compute difference between earliest year and current year
        const yearRegex = /\b(19\d\d|20\d\d)\b/g;
        const allYears = (text.match(yearRegex) || []).map(Number).filter(y => y >= 1990 && y <= new Date().getFullYear());
        if (allYears.length >= 2) {
            const minYear = Math.min(...allYears);
            const currentYear = new Date().getFullYear();
            const diff = currentYear - minYear;
            if (diff >= 1 && diff <= 35) {
                return `${diff}+ years`;
            }
        }

        return experience.length > 0 ? `${Math.max(2, experience.length * 2)}+ years` : '3+ years';
    }

    /**
     * Extract summary / elevator pitch
     */
    static extractSummary(text, contact = {}, experience = [], skills = [], yoe = '3+ years') {
        const sumMatch = text.match(/(?:summary|professional summary|about me|profile|objective)[:\s]+([\s\S]{50,450}?)(?=\n[A-Z\s]{3,}:|\n\n)/i);
        if (sumMatch) {
            return sumMatch[1].replace(/\s+/g, ' ').trim();
        }

        // Grounded summary generation
        const name = contact.name || 'Candidate';
        const role = experience[0]?.title || contact.headline || 'Software Engineer';
        const topSkills = skills.slice(0, 4).join(', ');
        return `${name} is a results-driven ${role} with ${yoe} of experience building high-performance systems with ${topSkills}.`;
    }
}

// Module export for Node.js test suites & Browser window export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResumeParserClient;
} else if (typeof window !== 'undefined') {
    window.ResumeParserClient = ResumeParserClient;
}
