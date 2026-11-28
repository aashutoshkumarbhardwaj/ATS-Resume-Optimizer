/**
 * SmartAnswerEngine
 * Client-side RAG for career page Q&A.
 * Classifies questions -> matches resume data -> generates <=100-word answers.
 * Zero API calls - all processing is local.
 */

const SmartAnswerEngine = (() => {

    // --- Question category patterns ---
    const CATEGORIES = [
        { name: 'about_yourself', patterns: [/tell.{0,20}about yourself/i, /introduce yourself/i, /who are you/i] },
        { name: 'why_company',   patterns: [/why.{0,20}(this company|us|our company|join us)/i, /what attract/i, /why do you want to work/i] },
        { name: 'why_role',      patterns: [/why.{0,20}(this role|position|job)/i, /why are you.{0,20}interested/i, /what.{0,20}motivate/i] },
        { name: 'strength',      patterns: [/\bstrength\b/i, /what.{0,15}(good at|best at|excel)/i, /greatest asset/i] },
        { name: 'weakness',      patterns: [/\bweakness\b/i, /area.{0,15}improve/i, /what.{0,15}work on/i] },
        { name: 'experience_years', patterns: [/how many years/i, /years of experience/i, /how long.{0,15}(work|experience)/i] },
        { name: 'experience_with',  patterns: [/experience with .+/i, /familiar with .+/i, /worked with .+/i, /knowledge of .+/i] },
        { name: 'salary',        patterns: [/salary expectation/i, /expected.{0,15}(ctc|salary|compensation|pay)/i, /what.{0,20}(earn|expect to make)/i] },
        { name: 'notice_period', patterns: [/notice period/i, /when.{0,20}(start|available|join)/i, /earliest.{0,15}(start|available)/i, /availability/i] },
        { name: 'location',      patterns: [/relocat/i, /willing to.{0,20}(travel|move)/i, /work.{0,15}(remote|onsite|hybrid)/i] },
        { name: 'achievement',   patterns: [/greatest achievement/i, /proud.{0,15}accomplishment/i, /describe.{0,15}success/i] },
        { name: 'challenge',     patterns: [/challenge.{0,20}(faced|overcome)/i, /difficult.{0,15}situation/i, /tough.{0,20}(time|project)/i] },
        { name: 'team',          patterns: [/team.{0,15}(work|player)/i, /work.{0,15}(with others|collaborat)/i] },
        { name: 'goal',          patterns: [/career goal/i, /where.{0,20}(5|five|10|ten) year/i, /long.{0,10}term goal/i] },
        { name: 'open',          patterns: [/.+\?/] }
    ];

    function classify(question) {
        for (const cat of CATEGORIES) {
            for (const pattern of cat.patterns) {
                if (pattern.test(question)) {
                    let subject = null;
                    if (cat.name === 'experience_with') {
                        const m = question.match(/(?:experience|familiar|worked|knowledge) (?:with|of|in) ([^?.\n,]{2,40})/i);
                        subject = m ? m[1].trim() : null;
                    }
                    return { category: cat.name, subject };
                }
            }
        }
        return { category: 'open', subject: null };
    }

    function findRelevantBullets(resumeData, keyword) {
        const kw = (keyword || '').toLowerCase();
        const bullets = [];
        (resumeData.experience || []).forEach(exp => {
            (exp.bullets || []).forEach(b => {
                if (b.toLowerCase().includes(kw)) bullets.push(b);
            });
        });
        return bullets;
    }

    function calcYearsExperience(resumeData) {
        const exps = resumeData.experience || [];
        if (!exps.length) return null;
        let minYear = new Date().getFullYear();
        exps.forEach(exp => {
            const start = exp.startDate || '';
            const yearMatch = start.match(/\b(20\d{2}|19\d{2})\b/);
            if (yearMatch) {
                const y = parseInt(yearMatch[1]);
                if (y < minYear) minYear = y;
            }
        });
        const computed = new Date().getFullYear() - minYear;
        return computed > 0 ? computed : exps.length;
    }

    function trim100(text) {
        if (!text) return '';
        const words = text.trim().split(/\s+/);
        if (words.length <= 100) return text.trim();
        return words.slice(0, 97).join(' ') + '...';
    }

    const GENERATORS = {
        about_yourself(r, p, subject, question, context = {}) {
            const name = r.contact?.name || p?.fullName || p?.name || p?.firstName || '';
            const title = context.jobTitle || r.contact?.currentTitle || p?.currentTitle || p?.current_title || 'Software Engineer';
            const yoe = calcYearsExperience(r) || p?.years_of_experience || '3+';
            const skills = (r.skills || (typeof p?.skills === 'string' ? p.skills.split(/[,;]+/) : p?.skills) || []).slice(0, 4).join(', ');
            const topBullet = r.experience?.[0]?.bullets?.[0] ? ` ${r.experience[0].bullets[0].replace(/^[•\-\*]\s*/, '').trim()}` : '';
            const targetComp = context.company ? ` at ${context.company}` : '';

            return trim100(`I am ${name ? name + ', a' : 'a'} results-driven ${title} with ${yoe} years of hands-on experience building scalable applications. My primary technical stack includes ${skills || 'full-stack engineering, cloud infrastructure, and modern APIs'}.${topBullet} I am eager to bring this engineering discipline and enthusiasm${targetComp} to deliver immediate high-impact results.`);
        },
        why_company(r, p, subject, question, context = {}) {
            const why = p?.whyInterested?.trim() || p?.why_interested?.trim() || p?.answer_why_company?.trim();
            if (why && why.length > 15) return trim100(why);

            const comp = context.company || 'your organization';
            const skills = (r.skills || (typeof p?.skills === 'string' ? p.skills.split(/[,;]+/) : p?.skills) || []).slice(0, 3).join(' and ');
            const title = context.jobTitle || r.contact?.currentTitle || p?.current_title || 'this position';

            return trim100(`I have been actively following ${comp}'s industry impact and technical trajectory. My background in ${skills || 'modern software architecture and product development'} directly aligns with the engineering excellence and high bar set by your team. I am excited to contribute my problem-solving ability and hands-on drive to help scale ${comp}'s mission.`);
        },
        why_role(r, p, subject, question, context = {}) {
            const title = context.jobTitle || r.contact?.currentTitle || p?.currentTitle || p?.current_title || 'this role';
            const skills = (r.skills || (typeof p?.skills === 'string' ? p.skills.split(/[,;]+/) : p?.skills) || []).slice(0, 3).join(', ');
            const topBullet = r.experience?.[0]?.bullets?.[0] ? ` Specifically, in my recent work, I ${r.experience[0].bullets[0].replace(/^[•\-\*]\s*/, '').toLowerCase().trim()}` : '';

            return trim100(`This position as ${title} perfectly bridges my technical background in ${skills || 'distributed systems and software development'} with my passion for shipping reliable, user-facing solutions.${topBullet} I am ready to hit the ground running and take complete ownership of core challenges in this role.`);
        },
        strength(r, p, subject, question, context = {}) {
            const s = p?.keyStrength?.trim() || p?.key_strength?.trim() || p?.answer_hire_you?.trim();
            if (s && s.length > 15) return trim100(s);

            const topSkills = (r.skills || (typeof p?.skills === 'string' ? p.skills.split(/[,;]+/) : p?.skills) || []).slice(0, 2).join(' and ');
            const bullet = r.experience?.[0]?.bullets?.[0] ? ` In my recent experience, I ${r.experience[0].bullets[0].replace(/^[•\-\*]\s*/, '').toLowerCase().trim()}` : '';

            return trim100(`My greatest strength is deep technical execution in ${topSkills || 'system architecture and problem solving'} paired with end-to-end product ownership.${bullet} I take pride in delivering resilient, clean code on schedule while collaborating closely across teams.`);
        },
        weakness(r, p) {
            return trim100(`Early on, I often took on too many tasks concurrently to ensure perfection across every detail. I overcame this by adopting rigorous sprint prioritization frameworks and automated CI/CD checks, allowing me to maintain exceptional software quality while accelerating delivery cadence.`);
        },
        experience_years(r, p, subject, question, context = {}) {
            const yoe = calcYearsExperience(r) || p?.years_of_experience || '3+';
            const title = context.jobTitle || r.contact?.currentTitle || p?.current_title || 'software engineering';
            return trim100(`I have ${yoe} years of professional experience in ${title}. Across my career, I have progressed from executing core architectural tasks to owning end-to-end features, driving measurable improvements in scalability, reliability, and code quality.`);
        },
        experience_with(r, p, subject, question, context = {}) {
            const kw = subject || 'this technology';
            const bullets = findRelevantBullets(r, kw);
            if (bullets.length) {
                return trim100(`I have extensive production experience with ${kw}. ${bullets[0].replace(/^[•\-\*]\s*/, '').trim()}`);
            }
            const allSkills = r.skills || (typeof p?.skills === 'string' ? p.skills.split(/[,;]+/) : p?.skills) || [];
            const inSkills = allSkills.some(s => s.toLowerCase().includes((kw).toLowerCase()));
            if (inSkills) {
                return trim100(`${kw} is part of my active technical stack. I have architected and deployed production solutions with it, focusing on modularity, robust error handling, and performance optimization.`);
            }
            const related = allSkills.slice(0, 3).join(', ');
            return trim100(`While my primary hands-on stack is centered around ${related || 'modern engineering frameworks'}, my foundational knowledge of system design and fast ramp-up capabilities enable me to master and apply ${kw} immediately in production.`);
        },
        salary(r, p) {
            const ctc = p?.expectedCTC?.trim() || p?.expected_salary?.trim();
            return ctc && ctc.length > 0
                ? trim100(`My target compensation is ${ctc}, in line with my experience and industry benchmarks. I am open to discussing the complete package based on overall benefits and equity opportunities.`)
                : trim100(`My compensation expectations are competitive and aligned with market standards for this position. I value the overall opportunity, growth scope, and total rewards, and am very open to discussing details.`);
        },
        notice_period(r, p) {
            const np = p?.noticePeriod?.trim() || p?.notice_period?.trim();
            return np && np.length > 0
                ? trim100(`My notice period is ${np}, and I can ensure a comprehensive transition with my current team.`)
                : trim100(`I am available to join within 2 to 4 weeks (or immediately depending on final formalities), ensuring a seamless and prompt onboarding.`);
        },
        location(r, p, subject, question, context = {}) {
            const mode = p?.workMode || p?.work_mode || 'flexible (remote, hybrid, or onsite)';
            return trim100(`I am fully open to ${mode} working arrangements. I have extensive experience collaborating asynchronously across distributed time zones as well as on-site teams.`);
        },
        achievement(r, p) {
            const bullet = r.experience?.[0]?.bullets?.[0] || r.experience?.[1]?.bullets?.[0] || null;
            if (bullet) {
                return trim100(`A defining achievement in my career was when I ${bullet.replace(/^[•\-\*]\s*/, '').toLowerCase().trim()} This delivered measurable business impact and demonstrated my ability to solve critical engineering challenges.`);
            }
            return trim100(`I led the architectural revamp of core services, reducing system latency by 35% and improving uptime. By aligning cross-functional teams and implementing automated tests, we delivered on time with zero production incidents.`);
        },
        challenge(r, p) {
            return trim100(`When confronted with a mission-critical production bottleneck under tight delivery constraints, I performed root-cause profiling, isolated the performance blocker, and engineered an optimized caching layer. This reduced load times by 40% while preserving data consistency.`);
        },
        team(r, p) {
            return trim100(`I excel in collaborative engineering teams. I advocate for open technical reviews, transparent communication, and mutual accountability. I mentor teammates when possible while continuously learning from collective domain insights.`);
        },
        goal(r, p, subject, question, context = {}) {
            const title = context.jobTitle || r.contact?.currentTitle || p?.current_title || 'senior engineering';
            return trim100(`Over the next few years, I aim to deepen my architectural expertise as a ${title}, spearhead high-impact technical initiatives, and mentor emerging engineers while driving sustainable product growth.`);
        },
        open(r, p, subject, question, context = {}) {
            const q = (question || '').toLowerCase();
            const comp = context.company || '';
            const title = context.jobTitle || r.contact?.currentTitle || p?.current_title || 'Software Engineer';
            const allSkills = (r.skills || (typeof p?.skills === 'string' ? p.skills.split(/[,;]+/) : p?.skills) || []).slice(0, 4).join(', ');
            const topBullet = r.experience?.[0]?.bullets?.[0] ? ` Notably, I ${r.experience[0].bullets[0].replace(/^[•\-\*]\s*/, '').toLowerCase().trim()}` : '';

            if (/project|portfolio|github|work sample|code/i.test(q)) {
                const link = p?.github || p?.portfolio || r.contact?.github || r.contact?.portfolio || '';
                return trim100(`I have architected and maintained production-grade projects utilizing ${allSkills || 'modern full-stack tools'}.${topBullet}${link ? ' You can review my work at ' + link + '.' : ''}`);
            }

            if (/lead|manage|mentor|culture|values/i.test(q)) {
                return trim100(`I actively foster an inclusive, high-ownership engineering culture. I prioritize clear documentation, proactive mentorship, and cross-functional transparency to ensure our team consistently delivers high-velocity, reliable software.`);
            }

            return trim100(`With a proven track record as a ${title} specializing in ${allSkills || 'scalable system development'}, I bring rigorous problem-solving and immediate execution capability.${topBullet} I am excited to apply these strengths${comp ? ' at ' + comp : ''} to deliver tangible, high-quality outcomes.`);
        }
    };

    function scoreConfidence(category, resumeData, subject) {
        if (category === 'open') return 80;
        if (category === 'experience_with' && subject) {
            const bullets = findRelevantBullets(resumeData, subject);
            if (bullets.length) return 95;
            const inSkills = (resumeData.skills || []).some(s => s.toLowerCase().includes((subject || '').toLowerCase()));
            return inSkills ? 88 : 75;
        }
        if (['salary', 'notice_period', 'location'].includes(category)) return 90;
        if (['about_yourself', 'strength', 'why_role', 'why_company', 'achievement', 'challenge', 'team', 'goal'].includes(category)) return 88;
        return 80;
    }

    return {
        generate(question, resumeData = {}, profile = {}, context = {}) {
            const { category, subject } = classify(question);
            const generator = GENERATORS[category] || GENERATORS.open;
            let answer;
            try { answer = generator(resumeData, profile, subject, question, context); }
            catch (e) { answer = GENERATORS.open(resumeData, profile, null, question, context); }
            return { answer: answer || '', category, confidence: scoreConfidence(category, resumeData, subject) };
        },
        generateAll(questions, resumeData = {}, profile = {}, context = {}) {
            return questions.map(q => ({ ...q, ...this.generate(q.question, resumeData, profile, context) }));
        }
    };
})();

if (typeof window !== 'undefined') {
    window.SmartAnswerEngine = SmartAnswerEngine;
}
if (typeof module !== 'undefined') {
    module.exports = SmartAnswerEngine;
}
