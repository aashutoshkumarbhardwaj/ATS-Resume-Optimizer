/**
 * Confidence Scorer Module
 * Calculates confidence scores for field matches
 * Determines autofill behavior based on confidence levels
 */

class ConfidenceScorer {
    constructor() {
        this.weights = this.initializeWeights();
        this.thresholds = {
            high: 0.85,      // Auto-fill immediately
            medium: 0.60,    // Ask for confirmation
            low: 0.0         // Skip and report
        };
        this.scoringHistory = [];
    }

    /**
     * Initialize weighting system
     */
    initializeWeights() {
        return {
            semantic: 0.40,      // Keyword/semantic matching
            nameMatch: 0.30,     // Name attribute matching
            typeMatch: 0.20,     // Input type matching
            contextMatch: 0.10   // Context/nearby text matching
        };
    }

    /**
     * Calculate overall confidence score
     */
    calculateConfidence(fieldMatch) {
        const score = 
            (fieldMatch.semanticScore || 0) * this.weights.semantic +
            (fieldMatch.nameScore || 0) * this.weights.nameMatch +
            (fieldMatch.typeScore || 0) * this.weights.typeMatch +
            (fieldMatch.contextScore || 0) * this.weights.contextMatch;

        return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
    }

    /**
     * Score semantic matching
     */
    scoreSemanticMatch(fieldLabel, profileKey) {
        const label = String(fieldLabel).toLowerCase();
        const key = String(profileKey).toLowerCase();

        // Exact match
        if (label === key || label.replace(/\s/g, '') === key.replace(/\s/g, '')) {
            return 1.0;
        }

        // Partial match
        const keywords = this.getKeywordsForField(profileKey);
        let score = 0;

        for (const keyword of keywords) {
            if (label.includes(keyword.toLowerCase())) {
                score += 0.2;
            }
        }

        return Math.min(score, 0.95);
    }

    /**
     * Score name attribute match
     */
    scoreNameMatch(fieldName, profileKey) {
        const name = String(fieldName).toLowerCase().replace(/[_\-]/g, '');
        const key = String(profileKey).toLowerCase().replace(/[_\-]/g, '');

        // Exact match
        if (name === key) {
            return 1.0;
        }

        // Partial word match
        if (name.includes(key) || key.includes(name)) {
            return 0.85;
        }

        // Similarity percentage
        return this.calculateStringSimilarity(name, key);
    }

    /**
     * Score input type match
     */
    scoreTypeMatch(inputType, expectedType) {
        const typeMapping = {
            email: ['email'],
            phone: ['tel', 'phone'],
            url: ['url'],
            date: ['date'],
            number: ['number'],
            text: ['text', 'search', 'password'],
            textarea: ['textarea'],
            select: ['select'],
            checkbox: ['checkbox'],
            radio: ['radio'],
            file: ['file']
        };

        const expectedTypes = typeMapping[expectedType] || [expectedType];
        
        if (expectedTypes.includes(inputType)) {
            return 1.0;
        }

        // Check if similar
        for (const type of expectedTypes) {
            if (this.calculateStringSimilarity(inputType, type) > 0.7) {
                return 0.7;
            }
        }

        return 0.3; // Type mismatch but not critical
    }

    /**
     * Score context match (nearby text)
     */
    scoreContextMatch(fieldContext, profileKey) {
        if (!fieldContext || !profileKey) {
            return 0;
        }

        const context = String(fieldContext).toLowerCase();
        const key = String(profileKey).toLowerCase();
        const keywords = this.getKeywordsForField(profileKey);

        let score = 0;

        // Check for exact key in context
        if (context.includes(key)) {
            score += 0.3;
        }

        // Check for related keywords
        for (const keyword of keywords) {
            if (context.includes(keyword.toLowerCase())) {
                score += 0.1;
            }
        }

        return Math.min(score, 1.0);
    }

    /**
     * Get keywords for profile field
     */
    getKeywordsForField(profileKey) {
        const keywordMap = {
            email: ['email', 'e-mail', 'contact', 'address'],
            phone: ['phone', 'mobile', 'tel', 'contact', 'number'],
            firstName: ['first', 'given', 'forename'],
            lastName: ['last', 'family', 'surname'],
            fullName: ['full', 'name', 'candidate', 'applicant'],
            address: ['address', 'street', 'location', 'residence'],
            city: ['city', 'location', 'municipality'],
            state: ['state', 'province', 'region'],
            zipCode: ['zip', 'postal', 'code'],
            country: ['country', 'nation', 'residence'],
            currentCompany: ['company', 'employer', 'organization', 'work'],
            jobTitle: ['job', 'title', 'position', 'designation'],
            yearsExperience: ['experience', 'years', 'level'],
            linkedin: ['linkedin', 'profile', 'social'],
            github: ['github', 'code', 'repository'],
            website: ['website', 'portfolio', 'web'],
            summary: ['summary', 'about', 'bio', 'introduction'],
            education: ['education', 'university', 'college', 'school'],
            degree: ['degree', 'qualification'],
            gpa: ['gpa', 'grade', 'score']
        };

        return keywordMap[profileKey] || [];
    }

    /**
     * Calculate string similarity (Levenshtein-based)
     */
    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) {
            return 1.0;
        }

        const editDistance = this.calculateEditDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate edit distance (Levenshtein)
     */
    calculateEditDistance(s1, s2) {
        const costs = [];
        
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) {
                costs[s2.length] = lastValue;
            }
        }
        return costs[s2.length];
    }

    /**
     * Classify confidence level
     */
    classifyConfidence(score) {
        if (score >= this.thresholds.high) {
            return {
                level: 'high',
                action: 'auto_fill',
                message: 'Will autofill automatically'
            };
        } else if (score >= this.thresholds.medium) {
            return {
                level: 'medium',
                action: 'confirm',
                message: 'Requires user confirmation'
            };
        } else {
            return {
                level: 'low',
                action: 'skip',
                message: 'Will skip this field'
            };
        }
    }

    /**
     * Score field match
     */
    scoreFieldMatch(fieldInfo, profileKey, profileData) {
        const scores = {
            semanticScore: this.scoreSemanticMatch(fieldInfo.label, profileKey),
            nameScore: this.scoreNameMatch(fieldInfo.name, profileKey),
            typeScore: this.scoreTypeMatch(fieldInfo.type, profileKey),
            contextScore: this.scoreContextMatch(fieldInfo.context, profileKey)
        };

        const confidence = this.calculateConfidence(scores);
        const classification = this.classifyConfidence(confidence);

        const result = {
            profileKey,
            confidence,
            scores,
            classification,
            recommendation: classification.action,
            reasoning: this.generateScoreReasoning(fieldInfo, profileKey, scores)
        };

        // Record in history
        this.recordScore(result);

        return result;
    }

    /**
     * Generate reasoning for score
     */
    generateScoreReasoning(fieldInfo, profileKey, scores) {
        const reasons = [];

        if (scores.semanticScore > 0.5) {
            reasons.push(`Semantic match: ${Math.round(scores.semanticScore * 100)}%`);
        }

        if (scores.nameScore > 0.5) {
            reasons.push(`Name match: ${Math.round(scores.nameScore * 100)}%`);
        }

        if (scores.typeScore > 0.5) {
            reasons.push(`Type match: ${Math.round(scores.typeScore * 100)}%`);
        }

        if (scores.contextScore > 0.3) {
            reasons.push(`Context match: ${Math.round(scores.contextScore * 100)}%`);
        }

        return reasons.join('; ');
    }

    /**
     * Score multiple field matches and rank them
     */
    scoreAndRankMatches(fieldInfo, possibleMatches) {
        const scoredMatches = possibleMatches.map(match => 
            this.scoreFieldMatch(fieldInfo, match.key, match.data)
        );

        scoredMatches.sort((a, b) => b.confidence - a.confidence);
        return scoredMatches;
    }

    /**
     * Get best match with minimum threshold
     */
    getBestMatch(fieldInfo, possibleMatches, minConfidence = 0.5) {
        const scored = this.scoreAndRankMatches(fieldInfo, possibleMatches);
        
        for (const match of scored) {
            if (match.confidence >= minConfidence) {
                return match;
            }
        }

        return null;
    }

    /**
     * Set custom thresholds
     */
    setThresholds(thresholds) {
        this.thresholds = {
            ...this.thresholds,
            ...thresholds
        };
    }

    /**
     * Set custom weights
     */
    setWeights(weights) {
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        
        if (Math.abs(total - 1) > 0.01) {
            throw new Error('Weights must sum to 1.0');
        }

        this.weights = weights;
    }

    /**
     * Record score in history
     */
    recordScore(score) {
        this.scoringHistory.push({
            ...score,
            timestamp: new Date().toISOString()
        });

        // Keep only last 1000 scores to avoid memory issues
        if (this.scoringHistory.length > 1000) {
            this.scoringHistory = this.scoringHistory.slice(-1000);
        }
    }

    /**
     * Get scoring statistics
     */
    getScoringStatistics() {
        if (this.scoringHistory.length === 0) {
            return null;
        }

        const scores = this.scoringHistory.map(h => h.confidence);
        const average = scores.reduce((a, b) => a + b, 0) / scores.length;
        const median = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)];
        const min = Math.min(...scores);
        const max = Math.max(...scores);

        const levelCounts = {
            high: this.scoringHistory.filter(h => h.classification.level === 'high').length,
            medium: this.scoringHistory.filter(h => h.classification.level === 'medium').length,
            low: this.scoringHistory.filter(h => h.classification.level === 'low').length
        };

        return {
            totalScores: this.scoringHistory.length,
            average,
            median,
            min,
            max,
            levelCounts,
            levelPercentages: {
                high: (levelCounts.high / this.scoringHistory.length * 100).toFixed(1) + '%',
                medium: (levelCounts.medium / this.scoringHistory.length * 100).toFixed(1) + '%',
                low: (levelCounts.low / this.scoringHistory.length * 100).toFixed(1) + '%'
            }
        };
    }

    /**
     * Reset scoring history
     */
    resetHistory() {
        this.scoringHistory = [];
    }

    /**
     * Score entire form
     */
    scoreForm(fields, profileData) {
        const fieldScores = [];
        let totalConfidence = 0;

        for (const field of fields) {
            // Get all possible profile keys
            const possibleMatches = this.getPossibleProfileMatches(profileData);
            
            const bestMatch = this.getBestMatch(field, possibleMatches);
            
            if (bestMatch) {
                fieldScores.push({
                    field,
                    match: bestMatch
                });
                totalConfidence += bestMatch.confidence;
            }
        }

        const averageConfidence = fieldScores.length > 0 
            ? totalConfidence / fieldScores.length 
            : 0;

        return {
            totalFields: fields.length,
            matchedFields: fieldScores.length,
            unmatchedFields: fields.length - fieldScores.length,
            averageConfidence,
            fieldScores,
            formClassification: this.classifyConfidence(averageConfidence)
        };
    }

    /**
     * Get possible profile matches (all profile fields)
     */
    getPossibleProfileMatches(profileData) {
        const matches = [];
        
        const traverse = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj || {})) {
                if (value !== null && value !== undefined && value !== '') {
                    const fullKey = prefix ? `${prefix}.${key}` : key;
                    
                    if (typeof value === 'object' && !Array.isArray(value)) {
                        traverse(value, fullKey);
                    } else {
                        matches.push({
                            key: fullKey,
                            data: value
                        });
                    }
                }
            }
        };

        traverse(profileData);
        return matches;
    }

    /**
     * Estimate autofill success rate
     */
    estimateSuccessRate(formScores) {
        if (formScores.length === 0) {
            return 0;
        }

        const successCount = formScores.filter(score => 
            score.formClassification.level !== 'low'
        ).length;

        return (successCount / formScores.length) * 100;
    }

    /**
     * Get confidence distribution
     */
    getConfidenceDistribution() {
        if (this.scoringHistory.length === 0) {
            return null;
        }

        const distribution = {
            veryHigh: this.scoringHistory.filter(h => h.confidence >= 0.95).length,
            high: this.scoringHistory.filter(h => h.confidence >= 0.85 && h.confidence < 0.95).length,
            medium: this.scoringHistory.filter(h => h.confidence >= 0.60 && h.confidence < 0.85).length,
            low: this.scoringHistory.filter(h => h.confidence < 0.60).length
        };

        return {
            ...distribution,
            total: this.scoringHistory.length,
            percentages: {
                veryHigh: ((distribution.veryHigh / this.scoringHistory.length) * 100).toFixed(1) + '%',
                high: ((distribution.high / this.scoringHistory.length) * 100).toFixed(1) + '%',
                medium: ((distribution.medium / this.scoringHistory.length) * 100).toFixed(1) + '%',
                low: ((distribution.low / this.scoringHistory.length) * 100).toFixed(1) + '%'
            }
        };
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfidenceScorer;
}
