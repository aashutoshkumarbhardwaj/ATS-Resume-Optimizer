/**
 * Enhanced Keyword Matcher Service
 * Provides advanced keyword extraction and matching with synonym handling,
 * normalization, and noise reduction
 */

class EnhancedKeywordMatcher {
    constructor() {
        this.synonymMap = this.buildSynonymMap();
        this.stopWords = this.buildStopWords();
        this.skillPriorities = this.buildSkillPriorities();
        this.normalizationRules = this.buildNormalizationRules();
    }

    /**
     * Extract and match keywords between resume and job description
     */
    matchKeywords(resumeText, jobDescription) {
        // Extract keywords from both texts
        const resumeKeywords = this.extractKeywords(resumeText);
        const jobKeywords = this.extractKeywords(jobDescription);

        // Perform advanced matching
        const matchResult = this.performAdvancedMatching(resumeKeywords, jobKeywords);

        return {
            matched: matchResult.matched,
            missing: matchResult.missing,
            matchedSkills: matchResult.matchedSkills,
            missingSkills: matchResult.missingSkills,
            confidence: matchResult.confidence,
            details: matchResult.details
        };
    }

    /**
     * Extract keywords from text with advanced processing
     */
    extractKeywords(text) {
        if (!text || typeof text !== 'string') {
            return { technical: [], soft: [], tools: [], certifications: [], phrases: [] };
        }

        const normalizedText = this.normalizeText(text);
        const keywords = {
            technical: [],
            soft: [],
            tools: [],
            certifications: [],
            phrases: []
        };

        // Extract different types of keywords
        keywords.technical = this.extractTechnicalSkills(normalizedText);
        keywords.soft = this.extractSoftSkills(normalizedText);
        keywords.tools = this.extractTools(normalizedText);
        keywords.certifications = this.extractCertifications(normalizedText);
        keywords.phrases = this.extractKeyPhrases(normalizedText);

        // Remove duplicates and prioritize
        this.deduplicateAndPrioritize(keywords);

        return keywords;
    }

    /**
     * Normalize text for better matching
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s\.\-\/\+#]/g, ' ') // Keep dots, dashes, slashes, plus, hash
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract technical skills with advanced pattern matching
     */
    extractTechnicalSkills(text) {
        const skills = new Set();
        
        // Enhanced technical skills database with variations
        const technicalPatterns = [
            // Programming Languages
            { patterns: ['javascript', 'js(?!on)', 'ecmascript'], canonical: 'JavaScript' },
            { patterns: ['typescript', 'ts(?!v|x)'], canonical: 'TypeScript' },
            { patterns: ['python', 'py(?!thon)'], canonical: 'Python' },
            { patterns: ['java(?!script)', 'jdk', 'jre'], canonical: 'Java' },
            { patterns: ['c\\+\\+', 'cpp', 'cplusplus'], canonical: 'C++' },
            { patterns: ['c#', 'csharp', 'c sharp'], canonical: 'C#' },
            { patterns: ['ruby', 'rb'], canonical: 'Ruby' },
            { patterns: ['php', 'php\\d+'], canonical: 'PHP' },
            { patterns: ['swift', 'swift\\d+'], canonical: 'Swift' },
            { patterns: ['kotlin', 'kt'], canonical: 'Kotlin' },
            { patterns: ['go', 'golang'], canonical: 'Go' },
            { patterns: ['rust', 'rustlang'], canonical: 'Rust' },
            { patterns: ['scala'], canonical: 'Scala' },
            { patterns: ['r programming', '\\br\\b'], canonical: 'R' },
            
            // Frontend Frameworks/Libraries
            { patterns: ['react', 'reactjs', 'react\\.js'], canonical: 'React' },
            { patterns: ['angular', 'angularjs', 'angular\\d+'], canonical: 'Angular' },
            { patterns: ['vue', 'vuejs', 'vue\\.js'], canonical: 'Vue.js' },
            { patterns: ['svelte', 'sveltekit'], canonical: 'Svelte' },
            { patterns: ['next\\.?js', 'nextjs'], canonical: 'Next.js' },
            { patterns: ['nuxt', 'nuxtjs'], canonical: 'Nuxt.js' },
            { patterns: ['ember', 'emberjs'], canonical: 'Ember.js' },
            { patterns: ['backbone', 'backbonejs'], canonical: 'Backbone.js' },
            { patterns: ['jquery', 'jquery\\d+'], canonical: 'jQuery' },
            
            // CSS/Styling
            { patterns: ['html5?', 'html'], canonical: 'HTML' },
            { patterns: ['css3?', 'css'], canonical: 'CSS' },
            { patterns: ['sass', 'scss'], canonical: 'Sass/SCSS' },
            { patterns: ['less'], canonical: 'Less' },
            { patterns: ['tailwind', 'tailwindcss'], canonical: 'Tailwind CSS' },
            { patterns: ['bootstrap', 'bootstrap\\d+'], canonical: 'Bootstrap' },
            { patterns: ['material.?ui', 'mui'], canonical: 'Material-UI' },
            
            // Build Tools
            { patterns: ['webpack', 'webpack\\d+'], canonical: 'Webpack' },
            { patterns: ['vite', 'vitejs'], canonical: 'Vite' },
            { patterns: ['parcel', 'parceljs'], canonical: 'Parcel' },
            { patterns: ['rollup', 'rollupjs'], canonical: 'Rollup' },
            { patterns: ['babel', 'babeljs'], canonical: 'Babel' },
            { patterns: ['gulp', 'gulpjs'], canonical: 'Gulp' },
            { patterns: ['grunt', 'gruntjs'], canonical: 'Grunt' },
            
            // Backend Frameworks
            { patterns: ['node\\.?js', 'nodejs'], canonical: 'Node.js' },
            { patterns: ['express', 'expressjs'], canonical: 'Express.js' },
            { patterns: ['fastify'], canonical: 'Fastify' },
            { patterns: ['koa', 'koajs'], canonical: 'Koa.js' },
            { patterns: ['django'], canonical: 'Django' },
            { patterns: ['flask'], canonical: 'Flask' },
            { patterns: ['fastapi'], canonical: 'FastAPI' },
            { patterns: ['spring', 'spring boot', 'springframework'], canonical: 'Spring' },
            { patterns: ['asp\\.?net', 'dotnet', '\\.net'], canonical: 'ASP.NET' },
            { patterns: ['laravel'], canonical: 'Laravel' },
            { patterns: ['symfony'], canonical: 'Symfony' },
            { patterns: ['rails', 'ruby on rails'], canonical: 'Ruby on Rails' },
            { patterns: ['nestjs'], canonical: 'NestJS' },
            
            // Databases
            { patterns: ['mongodb', 'mongo'], canonical: 'MongoDB' },
            { patterns: ['postgresql', 'postgres'], canonical: 'PostgreSQL' },
            { patterns: ['mysql'], canonical: 'MySQL' },
            { patterns: ['sqlite'], canonical: 'SQLite' },
            { patterns: ['redis'], canonical: 'Redis' },
            { patterns: ['elasticsearch', 'elastic search'], canonical: 'Elasticsearch' },
            { patterns: ['dynamodb', 'dynamo db'], canonical: 'DynamoDB' },
            { patterns: ['cassandra'], canonical: 'Cassandra' },
            { patterns: ['oracle', 'oracle db'], canonical: 'Oracle' },
            { patterns: ['sql server', 'mssql'], canonical: 'SQL Server' },
            { patterns: ['mariadb'], canonical: 'MariaDB' },
            { patterns: ['couchdb'], canonical: 'CouchDB' },
            { patterns: ['neo4j'], canonical: 'Neo4j' },
            
            // Cloud Platforms
            { patterns: ['aws', 'amazon web services'], canonical: 'AWS' },
            { patterns: ['azure', 'microsoft azure'], canonical: 'Azure' },
            { patterns: ['gcp', 'google cloud', 'google cloud platform'], canonical: 'Google Cloud' },
            { patterns: ['heroku'], canonical: 'Heroku' },
            { patterns: ['vercel'], canonical: 'Vercel' },
            { patterns: ['netlify'], canonical: 'Netlify' },
            { patterns: ['digitalocean'], canonical: 'DigitalOcean' },
            
            // DevOps & Infrastructure
            { patterns: ['docker'], canonical: 'Docker' },
            { patterns: ['kubernetes', 'k8s'], canonical: 'Kubernetes' },
            { patterns: ['jenkins'], canonical: 'Jenkins' },
            { patterns: ['gitlab ci', 'gitlab-ci'], canonical: 'GitLab CI' },
            { patterns: ['github actions'], canonical: 'GitHub Actions' },
            { patterns: ['circleci'], canonical: 'CircleCI' },
            { patterns: ['travis ci', 'travis-ci'], canonical: 'Travis CI' },
            { patterns: ['terraform'], canonical: 'Terraform' },
            { patterns: ['ansible'], canonical: 'Ansible' },
            { patterns: ['chef'], canonical: 'Chef' },
            { patterns: ['puppet'], canonical: 'Puppet' },
            { patterns: ['vagrant'], canonical: 'Vagrant' },
            { patterns: ['helm'], canonical: 'Helm' },
            
            // APIs & Protocols
            { patterns: ['rest api', 'restful', 'rest'], canonical: 'REST API' },
            { patterns: ['graphql', 'graph ql'], canonical: 'GraphQL' },
            { patterns: ['soap'], canonical: 'SOAP' },
            { patterns: ['grpc', 'grpc'], canonical: 'gRPC' },
            { patterns: ['websocket', 'web socket'], canonical: 'WebSocket' },
            { patterns: ['oauth', 'oauth\\d+'], canonical: 'OAuth' },
            { patterns: ['jwt', 'json web token'], canonical: 'JWT' },
            { patterns: ['saml'], canonical: 'SAML' },
            
            // Data & ML
            { patterns: ['machine learning', 'ml'], canonical: 'Machine Learning' },
            { patterns: ['deep learning', 'dl'], canonical: 'Deep Learning' },
            { patterns: ['artificial intelligence', 'ai'], canonical: 'AI' },
            { patterns: ['tensorflow', 'tf'], canonical: 'TensorFlow' },
            { patterns: ['pytorch'], canonical: 'PyTorch' },
            { patterns: ['keras'], canonical: 'Keras' },
            { patterns: ['scikit.?learn', 'sklearn'], canonical: 'Scikit-learn' },
            { patterns: ['pandas'], canonical: 'Pandas' },
            { patterns: ['numpy'], canonical: 'NumPy' },
            { patterns: ['matplotlib'], canonical: 'Matplotlib' },
            { patterns: ['seaborn'], canonical: 'Seaborn' },
            { patterns: ['jupyter'], canonical: 'Jupyter' },
            { patterns: ['apache spark', 'spark'], canonical: 'Apache Spark' },
            { patterns: ['hadoop'], canonical: 'Hadoop' },
            { patterns: ['kafka'], canonical: 'Kafka' },
            { patterns: ['airflow'], canonical: 'Airflow' },
            
            // Mobile Development
            { patterns: ['ios development', 'ios'], canonical: 'iOS' },
            { patterns: ['android development', 'android'], canonical: 'Android' },
            { patterns: ['react native'], canonical: 'React Native' },
            { patterns: ['flutter'], canonical: 'Flutter' },
            { patterns: ['xamarin'], canonical: 'Xamarin' },
            { patterns: ['cordova', 'phonegap'], canonical: 'Cordova' },
            
            // Testing
            { patterns: ['jest'], canonical: 'Jest' },
            { patterns: ['mocha'], canonical: 'Mocha' },
            { patterns: ['chai'], canonical: 'Chai' },
            { patterns: ['cypress'], canonical: 'Cypress' },
            { patterns: ['selenium'], canonical: 'Selenium' },
            { patterns: ['puppeteer'], canonical: 'Puppeteer' },
            { patterns: ['playwright'], canonical: 'Playwright' },
            { patterns: ['junit'], canonical: 'JUnit' },
            { patterns: ['pytest'], canonical: 'PyTest' },
            { patterns: ['rspec'], canonical: 'RSpec' }
        ];

        // Match patterns
        for (const skillGroup of technicalPatterns) {
            for (const pattern of skillGroup.patterns) {
                const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
                if (regex.test(text)) {
                    skills.add(skillGroup.canonical);
                    break; // Found one pattern, no need to check others in this group
                }
            }
        }

        return Array.from(skills);
    }

    /**
     * Extract soft skills
     */
    extractSoftSkills(text) {
        const skills = new Set();
        
        const softSkillPatterns = [
            { patterns: ['leadership', 'lead', 'leading'], canonical: 'Leadership' },
            { patterns: ['communication', 'communicating', 'communicate'], canonical: 'Communication' },
            { patterns: ['teamwork', 'team work', 'collaboration', 'collaborative'], canonical: 'Teamwork' },
            { patterns: ['problem solving', 'problem-solving', 'troubleshooting'], canonical: 'Problem Solving' },
            { patterns: ['analytical', 'analysis', 'analyze'], canonical: 'Analytical Skills' },
            { patterns: ['critical thinking'], canonical: 'Critical Thinking' },
            { patterns: ['creativity', 'creative', 'innovation', 'innovative'], canonical: 'Creativity' },
            { patterns: ['adaptability', 'adaptable', 'flexible', 'flexibility'], canonical: 'Adaptability' },
            { patterns: ['time management', 'time-management'], canonical: 'Time Management' },
            { patterns: ['project management', 'project-management'], canonical: 'Project Management' },
            { patterns: ['mentoring', 'mentor', 'coaching', 'coach'], canonical: 'Mentoring' },
            { patterns: ['presentation', 'presenting', 'public speaking'], canonical: 'Presentation Skills' },
            { patterns: ['negotiation', 'negotiating'], canonical: 'Negotiation' },
            { patterns: ['decision making', 'decision-making'], canonical: 'Decision Making' },
            { patterns: ['strategic thinking', 'strategic planning'], canonical: 'Strategic Thinking' },
            { patterns: ['attention to detail', 'detail-oriented'], canonical: 'Attention to Detail' },
            { patterns: ['self-motivated', 'self motivated', 'motivated'], canonical: 'Self-Motivated' },
            { patterns: ['proactive'], canonical: 'Proactive' },
            { patterns: ['organized', 'organization'], canonical: 'Organization' },
            { patterns: ['multitasking', 'multi-tasking'], canonical: 'Multitasking' }
        ];

        for (const skillGroup of softSkillPatterns) {
            for (const pattern of skillGroup.patterns) {
                const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
                if (regex.test(text)) {
                    skills.add(skillGroup.canonical);
                    break;
                }
            }
        }

        return Array.from(skills);
    }

    /**
     * Extract tools and platforms
     */
    extractTools(text) {
        const tools = new Set();
        
        const toolPatterns = [
            { patterns: ['git', 'github', 'gitlab', 'bitbucket'], canonical: 'Git' },
            { patterns: ['jira'], canonical: 'Jira' },
            { patterns: ['confluence'], canonical: 'Confluence' },
            { patterns: ['slack'], canonical: 'Slack' },
            { patterns: ['trello'], canonical: 'Trello' },
            { patterns: ['asana'], canonical: 'Asana' },
            { patterns: ['notion'], canonical: 'Notion' },
            { patterns: ['figma'], canonical: 'Figma' },
            { patterns: ['sketch'], canonical: 'Sketch' },
            { patterns: ['adobe xd', 'xd'], canonical: 'Adobe XD' },
            { patterns: ['photoshop'], canonical: 'Photoshop' },
            { patterns: ['illustrator'], canonical: 'Illustrator' },
            { patterns: ['postman'], canonical: 'Postman' },
            { patterns: ['swagger'], canonical: 'Swagger' },
            { patterns: ['vs code', 'visual studio code'], canonical: 'VS Code' },
            { patterns: ['intellij', 'idea'], canonical: 'IntelliJ IDEA' },
            { patterns: ['eclipse'], canonical: 'Eclipse' },
            { patterns: ['visual studio'], canonical: 'Visual Studio' },
            { patterns: ['sublime text'], canonical: 'Sublime Text' },
            { patterns: ['vim', 'neovim'], canonical: 'Vim' },
            { patterns: ['emacs'], canonical: 'Emacs' }
        ];

        for (const toolGroup of toolPatterns) {
            for (const pattern of toolGroup.patterns) {
                const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
                if (regex.test(text)) {
                    tools.add(toolGroup.canonical);
                    break;
                }
            }
        }

        return Array.from(tools);
    }

    /**
     * Extract certifications
     */
    extractCertifications(text) {
        const certs = new Set();
        
        const certPatterns = [
            { patterns: ['aws certified', 'aws certification'], canonical: 'AWS Certified' },
            { patterns: ['azure certified', 'azure certification'], canonical: 'Azure Certified' },
            { patterns: ['gcp certified', 'google cloud certified'], canonical: 'GCP Certified' },
            { patterns: ['pmp', 'project management professional'], canonical: 'PMP' },
            { patterns: ['scrum master', 'csm', 'certified scrum master'], canonical: 'Scrum Master' },
            { patterns: ['psm', 'professional scrum master'], canonical: 'PSM' },
            { patterns: ['cissp'], canonical: 'CISSP' },
            { patterns: ['comptia', 'comp tia'], canonical: 'CompTIA' },
            { patterns: ['ceh', 'certified ethical hacker'], canonical: 'CEH' },
            { patterns: ['cka', 'certified kubernetes administrator'], canonical: 'CKA' },
            { patterns: ['ckad', 'certified kubernetes application developer'], canonical: 'CKAD' }
        ];

        for (const certGroup of certPatterns) {
            for (const pattern of certGroup.patterns) {
                const regex = new RegExp(pattern, 'gi');
                if (regex.test(text)) {
                    certs.add(certGroup.canonical);
                    break;
                }
            }
        }

        return Array.from(certs);
    }

    /**
     * Extract key phrases (2-3 word combinations)
     */
    extractKeyPhrases(text) {
        const phrases = new Set();
        
        const keyPhrasePatterns = [
            'full stack', 'front end', 'back end', 'software development', 'web development',
            'mobile development', 'data analysis', 'data science', 'machine learning',
            'artificial intelligence', 'cloud computing', 'devops', 'agile development',
            'test driven development', 'continuous integration', 'continuous deployment',
            'microservices architecture', 'api development', 'database design',
            'user experience', 'user interface', 'responsive design', 'cross platform',
            'version control', 'code review', 'performance optimization', 'security testing',
            'load testing', 'unit testing', 'integration testing', 'system administration',
            'network security', 'data visualization', 'business intelligence'
        ];

        for (const phrase of keyPhrasePatterns) {
            const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
            if (regex.test(text)) {
                phrases.add(phrase.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' '));
            }
        }

        return Array.from(phrases);
    }

    /**
     * Perform advanced matching with synonym handling
     */
    performAdvancedMatching(resumeKeywords, jobKeywords) {
        const matched = new Set();
        const missing = new Set();
        const matchedSkills = new Set();
        const missingSkills = new Set();
        const details = [];

        // Combine all job keywords for comprehensive matching
        const allJobKeywords = [
            ...jobKeywords.technical,
            ...jobKeywords.soft,
            ...jobKeywords.tools,
            ...jobKeywords.certifications,
            ...jobKeywords.phrases
        ];

        const allResumeKeywords = [
            ...resumeKeywords.technical,
            ...resumeKeywords.soft,
            ...resumeKeywords.tools,
            ...resumeKeywords.certifications,
            ...resumeKeywords.phrases
        ];

        // Check each job keyword against resume
        for (const jobKeyword of allJobKeywords) {
            const matchResult = this.findBestMatch(jobKeyword, allResumeKeywords);
            
            if (matchResult.found) {
                matched.add(jobKeyword);
                matchedSkills.add(jobKeyword);
                details.push({
                    jobKeyword,
                    resumeMatch: matchResult.match,
                    matchType: matchResult.type,
                    confidence: matchResult.confidence
                });
            } else {
                missing.add(jobKeyword);
                missingSkills.add(jobKeyword);
            }
        }

        // Calculate overall confidence
        const totalKeywords = allJobKeywords.length;
        const matchedCount = matched.size;
        const confidence = totalKeywords > 0 ? (matchedCount / totalKeywords) * 100 : 0;

        return {
            matched: Array.from(matched),
            missing: Array.from(missing),
            matchedSkills: Array.from(matchedSkills),
            missingSkills: Array.from(missingSkills),
            confidence: Math.round(confidence),
            details
        };
    }

    /**
     * Find best match for a keyword using various strategies
     */
    findBestMatch(jobKeyword, resumeKeywords) {
        const normalizedJobKeyword = this.normalizeKeyword(jobKeyword);
        
        // Strategy 1: Exact match
        for (const resumeKeyword of resumeKeywords) {
            const normalizedResumeKeyword = this.normalizeKeyword(resumeKeyword);
            if (normalizedJobKeyword === normalizedResumeKeyword) {
                return {
                    found: true,
                    match: resumeKeyword,
                    type: 'exact',
                    confidence: 100
                };
            }
        }

        // Strategy 2: Synonym match
        const synonyms = this.getSynonyms(normalizedJobKeyword);
        for (const synonym of synonyms) {
            for (const resumeKeyword of resumeKeywords) {
                const normalizedResumeKeyword = this.normalizeKeyword(resumeKeyword);
                if (synonym === normalizedResumeKeyword) {
                    return {
                        found: true,
                        match: resumeKeyword,
                        type: 'synonym',
                        confidence: 90
                    };
                }
            }
        }

        // Strategy 3: Partial match (contains)
        for (const resumeKeyword of resumeKeywords) {
            const normalizedResumeKeyword = this.normalizeKeyword(resumeKeyword);
            if (normalizedResumeKeyword.includes(normalizedJobKeyword) || 
                normalizedJobKeyword.includes(normalizedResumeKeyword)) {
                return {
                    found: true,
                    match: resumeKeyword,
                    type: 'partial',
                    confidence: 75
                };
            }
        }

        // Strategy 4: Fuzzy match (for typos and variations)
        for (const resumeKeyword of resumeKeywords) {
            const similarity = this.calculateSimilarity(normalizedJobKeyword, this.normalizeKeyword(resumeKeyword));
            if (similarity > 0.8) {
                return {
                    found: true,
                    match: resumeKeyword,
                    type: 'fuzzy',
                    confidence: Math.round(similarity * 100)
                };
            }
        }

        return { found: false };
    }

    /**
     * Normalize keyword for better matching
     */
    normalizeKeyword(keyword) {
        return keyword
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Get synonyms for a keyword
     */
    getSynonyms(keyword) {
        const normalizedKeyword = this.normalizeKeyword(keyword);
        return this.synonymMap[normalizedKeyword] || [];
    }

    /**
     * Calculate string similarity using Levenshtein distance
     */
    calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        
        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

        const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));

        for (let i = 0; i <= len1; i++) matrix[0][i] = i;
        for (let j = 0; j <= len2; j++) matrix[j][0] = j;

        for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j - 1][i] + 1,
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }

        const maxLen = Math.max(len1, len2);
        return (maxLen - matrix[len2][len1]) / maxLen;
    }

    /**
     * Remove duplicates and prioritize keywords
     */
    deduplicateAndPrioritize(keywords) {
        for (const category in keywords) {
            if (Array.isArray(keywords[category])) {
                // Remove duplicates
                keywords[category] = [...new Set(keywords[category])];
                
                // Sort by priority (if available)
                keywords[category].sort((a, b) => {
                    const priorityA = this.skillPriorities[a.toLowerCase()] || 50;
                    const priorityB = this.skillPriorities[b.toLowerCase()] || 50;
                    return priorityB - priorityA; // Higher priority first
                });
            }
        }
    }

    /**
     * Build comprehensive synonym map
     */
    buildSynonymMap() {
        return {
            'javascript': ['js', 'ecmascript', 'es6', 'es2015', 'es2020'],
            'typescript': ['ts'],
            'node.js': ['node', 'nodejs'],
            'react': ['reactjs', 'react.js'],
            'angular': ['angularjs', 'angular.js'],
            'vue.js': ['vue', 'vuejs'],
            'python': ['py'],
            'c++': ['cpp', 'cplusplus'],
            'c#': ['csharp', 'c sharp'],
            'aws': ['amazon web services'],
            'gcp': ['google cloud', 'google cloud platform'],
            'azure': ['microsoft azure'],
            'rest api': ['restful', 'rest', 'restful api', 'restful services'],
            'graphql': ['graph ql'],
            'mongodb': ['mongo'],
            'postgresql': ['postgres'],
            'machine learning': ['ml'],
            'artificial intelligence': ['ai'],
            'deep learning': ['dl'],
            'continuous integration': ['ci'],
            'continuous deployment': ['cd'],
            'devops': ['dev ops'],
            'frontend': ['front end', 'front-end'],
            'backend': ['back end', 'back-end'],
            'fullstack': ['full stack', 'full-stack'],
            'ui': ['user interface'],
            'ux': ['user experience'],
            'api': ['application programming interface'],
            'sql': ['structured query language'],
            'nosql': ['no sql'],
            'html': ['hypertext markup language'],
            'css': ['cascading style sheets'],
            'json': ['javascript object notation'],
            'xml': ['extensible markup language'],
            'yaml': ['yml'],
            'docker': ['containerization'],
            'kubernetes': ['k8s', 'container orchestration'],
            'microservices': ['micro services'],
            'serverless': ['server less'],
            'saas': ['software as a service'],
            'paas': ['platform as a service'],
            'iaas': ['infrastructure as a service']
        };
    }

    /**
     * Build stop words list
     */
    buildStopWords() {
        return new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
            'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
            'my', 'your', 'his', 'her', 'its', 'our', 'their', 'work', 'working', 'worked',
            'experience', 'years', 'year', 'strong', 'good', 'excellent', 'great', 'best',
            'responsible', 'duties', 'tasks', 'job', 'role', 'position', 'candidate',
            'required', 'preferred', 'must', 'should', 'ability', 'skills', 'knowledge'
        ]);
    }

    /**
     * Build skill priorities (higher number = higher priority)
     */
    buildSkillPriorities() {
        return {
            // High priority technical skills
            'javascript': 95,
            'python': 95,
            'java': 90,
            'react': 90,
            'node.js': 90,
            'aws': 85,
            'docker': 85,
            'kubernetes': 85,
            'typescript': 80,
            'angular': 80,
            'vue.js': 80,
            'mongodb': 75,
            'postgresql': 75,
            'rest api': 75,
            'graphql': 70,
            'machine learning': 85,
            'artificial intelligence': 85,
            
            // Medium priority
            'git': 60,
            'html': 50,
            'css': 50,
            'sql': 65,
            
            // Soft skills (lower priority for technical matching)
            'communication': 30,
            'teamwork': 30,
            'leadership': 35,
            'problem solving': 40
        };
    }

    /**
     * Build normalization rules
     */
    buildNormalizationRules() {
        return [
            { pattern: /\b(\w+)s\b/g, replacement: '$1' }, // Remove plural 's'
            { pattern: /\b(\w+)ing\b/g, replacement: '$1' }, // Remove 'ing' suffix
            { pattern: /\b(\w+)ed\b/g, replacement: '$1' }, // Remove 'ed' suffix
            { pattern: /[^\w\s]/g, replacement: ' ' }, // Remove special characters
            { pattern: /\s+/g, replacement: ' ' } // Normalize whitespace
        ];
    }
}

module.exports = EnhancedKeywordMatcher;