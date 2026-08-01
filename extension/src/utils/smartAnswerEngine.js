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
        about_yourself(r, p) {
            const name  = r.contact?.name || p?.firstName || '';
            const title = r.contact?.currentTitle || p?.currentTitle || 'professional';
            const yoe   = calcYearsExperience(r);
            const skills = (r.skills || []).slice(0, 3).join(', ');
            const edu = (r.education || [])[0];
            const eduLine = edu ? ` I hold a ${edu.degree || 'degree'} from ${edu.institution || 'university'}.` : '';
            return trim100(`${name ? 'I am ' + name + ', a' : 'I am a'} ${title} with ${yoe ? yoe + '+' : 'several'} years of experience. My expertise spans ${skills || 'software development and system design'}.${eduLine} I am passionate about delivering impactful work and continuous learning.`);
        },
        why_company(r, p) {
            const why = p?.whyInterested?.trim();
            if (why && why.length > 10) return trim100(why);
            const skills = (r.skills || []).slice(0, 2).join(' and ');
            return trim100(`I am drawn to this company for its strong reputation and commitment to innovation. My background in ${skills || 'relevant technologies'} aligns well with your goals, and I am excited about contributing meaningfully to your team.`);
        },
        why_role(r, p) {
            const title = r.contact?.currentTitle || p?.currentTitle || 'this field';
            const skills = (r.skills || []).slice(0, 3).join(', ');
            return trim100(`This role is an excellent match for my experience as a ${title}. I have built strong expertise in ${skills || 'the required skills'} and I am eager to apply this knowledge to drive real results in this position.`);
        },
        strength(r, p) {
            const s = p?.keyStrength?.trim();
            if (s && s.length > 10) return trim100(s);
            const topSkill = (r.skills || [])[0] || 'problem-solving';
            const bullet   = r.experience?.[0]?.bullets?.[0] || '';
            return trim100(`My greatest strength is ${topSkill} combined with attention to detail. ${bullet ? 'For example, I ' + bullet.replace(/^[•\-\*]\s*/, '').toLowerCase() + '.' : ''} I consistently apply this focus to deliver quality outcomes on time.`);
        },
        weakness(r, p) {
            return trim100(`I tend to be detail-oriented to a fault, spending extra time perfecting work. I have actively addressed this by setting clear time limits and using structured prioritisation frameworks to balance quality with delivery speed.`);
        },
        experience_years(r, p) {
            const yoe = calcYearsExperience(r);
            const title = r.contact?.currentTitle || 'this domain';
            return trim100(`I have approximately ${yoe || 'several'} years of experience in ${title}. Over this time I have delivered across multiple projects, progressing from hands-on individual contributor to leading end-to-end initiatives.`);
        },
        experience_with(r, p, subject) {
            const kw = subject || 'this technology';
            const bullets = findRelevantBullets(r, kw);
            if (bullets.length) return trim100(`I have solid hands-on experience with ${kw}. ${bullets[0].replace(/^[•\-\*]\s*/, '')}`);
            const inSkills = (r.skills || []).some(s => s.toLowerCase().includes((kw).toLowerCase()));
            if (inSkills) return trim100(`${kw} is part of my core skill set. I have applied it across professional projects and am confident working with it independently.`);
            return trim100(`While my direct professional exposure to ${kw} is limited, I have foundational knowledge and a strong track record of picking up new technologies quickly based on my background.`);
        },
        salary(r, p) {
            const ctc = p?.expectedCTC?.trim();
            return ctc && ctc.length > 0
                ? trim100(`My expected compensation is ${ctc}, reflecting my experience and market benchmarks for this role. I am open to discussing the full package including benefits and growth opportunities.`)
                : trim100(`My salary expectations are competitive and negotiable based on the overall compensation package, scope of the role, and growth opportunities. I am happy to discuss further.`);
        },
        notice_period(r, p) {
            const np = p?.noticePeriod?.trim();
            return np && np.length > 0
                ? trim100(`My current notice period is ${np}. I can coordinate with my current employer to ensure a smooth and professional transition.`)
                : trim100(`I can typically be available within 2 to 4 weeks, allowing adequate time to complete handovers and ensure a smooth transition from my current role.`);
        },
        location(r, p) {
            const mode = p?.workMode || 'flexible';
            return trim100(`I am open to ${mode} working arrangements. I have experience in both remote and onsite environments and can adapt to whatever works best for the team and organisation.`);
        },
        achievement(r, p) {
            const bullet = r.experience?.[0]?.bullets?.[0] || null;
            if (bullet) return trim100(`One achievement I am proud of is when I ${bullet.replace(/^[•\-\*]\s*/, '').toLowerCase()} This had a measurable positive impact and demonstrated my ability to deliver under pressure.`);
            return trim100(`I led a cross-functional initiative that significantly improved delivery speed and reduced errors. Through structured planning and proactive communication, the project was completed ahead of schedule with measurable outcomes.`);
        },
        challenge(r, p) {
            return trim100(`I once managed a project with rapidly shifting requirements and a tight deadline. I broke the work into phases, aligned stakeholders on priorities, and delivered on time. This taught me the value of clear communication and adaptive planning.`);
        },
        team(r, p) {
            return trim100(`I thrive in collaborative settings. I believe strong teamwork is built on clear communication, mutual respect, and shared ownership. I adapt my style to the team's needs while proactively contributing to collective goals.`);
        },
        goal(r, p) {
            const title = r.contact?.currentTitle || 'my field';
            return trim100(`In the next five years I aim to deepen my expertise in ${title}, take on greater leadership responsibilities, and contribute to high-impact products. I also want to mentor others and give back to the community.`);
        },
        open(r, p, subject, question) {
            const summary = r.summary;
            if (summary && summary.length > 20) return trim100(summary);
            const bullet = r.experience?.[0]?.bullets?.[0];
            if (bullet) return trim100(bullet.replace(/^[•\-\*]\s*/, ''));
            return trim100(`Based on my background and experience, I am well positioned to contribute to this area. I would be happy to discuss specific examples and how I can add value in this role.`);
        }
    };

    function scoreConfidence(category, resumeData, subject) {
        if (category === 'open') return 40;
        if (category === 'experience_with' && subject) {
            const bullets = findRelevantBullets(resumeData, subject);
            if (bullets.length) return 92;
            const inSkills = (resumeData.skills || []).some(s => s.toLowerCase().includes((subject || '').toLowerCase()));
            return inSkills ? 78 : 52;
        }
        if (['salary', 'notice_period'].includes(category)) return 85;
        if (['about_yourself', 'strength', 'why_role', 'why_company'].includes(category)) return 80;
        return 70;
    }

    return {
        generate(question, resumeData = {}, profile = {}) {
            const { category, subject } = classify(question);
            const generator = GENERATORS[category] || GENERATORS.open;
            let answer;
            try { answer = generator(resumeData, profile, subject, question); }
            catch (e) { answer = GENERATORS.open(resumeData, profile, null, question); }
            return { answer: answer || '', category, confidence: scoreConfidence(category, resumeData, subject) };
        },
        generateAll(questions, resumeData = {}, profile = {}) {
            return questions.map(q => ({ ...q, ...this.generate(q.question, resumeData, profile) }));
        }
    };
})();

if (typeof module !== 'undefined') module.exports = SmartAnswerEngine;
