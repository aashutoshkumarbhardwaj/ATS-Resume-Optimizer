/**
 * Confidence Scorer Tests
 * Unit tests for confidence scoring and field matching
 */

describe('ConfidenceScorer', () => {
    let scorer;

    beforeEach(() => {
        scorer = new ConfidenceScorer();
    });

    describe('initialization', () => {
        it('should initialize with default weights', () => {
            expect(scorer.weights.semantic).toBe(0.40);
            expect(scorer.weights.nameMatch).toBe(0.30);
            expect(scorer.weights.typeMatch).toBe(0.20);
            expect(scorer.weights.contextMatch).toBe(0.10);
        });

        it('should initialize with default thresholds', () => {
            expect(scorer.thresholds.high).toBe(0.85);
            expect(scorer.thresholds.medium).toBe(0.60);
            expect(scorer.thresholds.low).toBe(0.0);
        });

        it('should initialize empty scoring history', () => {
            expect(scorer.scoringHistory.length).toBe(0);
        });
    });

    describe('calculateConfidence', () => {
        it('should calculate confidence from component scores', () => {
            const fieldMatch = {
                semanticScore: 0.95,
                nameScore: 0.80,
                typeScore: 0.70,
                contextScore: 0.60
            };

            const confidence = scorer.calculateConfidence(fieldMatch);
            
            const expected = (0.95 * 0.40) + (0.80 * 0.30) + (0.70 * 0.20) + (0.60 * 0.10);
            expect(Math.abs(confidence - expected)).toBeLessThan(0.01);
        });

        it('should clamp score between 0 and 1', () => {
            const fieldMatch = {
                semanticScore: 1.5,
                nameScore: 2.0,
                typeScore: 3.0,
                contextScore: 4.0
            };

            const confidence = scorer.calculateConfidence(fieldMatch);
            expect(confidence).toBeLessThanOrEqual(1);
            expect(confidence).toBeGreaterThanOrEqual(0);
        });

        it('should handle missing scores as 0', () => {
            const fieldMatch = {
                semanticScore: 0.8
            };

            const confidence = scorer.calculateConfidence(fieldMatch);
            expect(confidence).toBeGreaterThan(0);
            expect(confidence).toBeLessThan(1);
        });
    });

    describe('scoreSemanticMatch', () => {
        it('should give perfect score for exact match', () => {
            const score = scorer.scoreSemanticMatch('email', 'email');
            expect(score).toBe(1.0);
        });

        it('should handle case-insensitive matching', () => {
            const score = scorer.scoreSemanticMatch('EMAIL', 'email');
            expect(score).toBe(1.0);
        });

        it('should handle whitespace normalization', () => {
            const score = scorer.scoreSemanticMatch('full name', 'fullName');
            expect(score).toBeGreaterThan(0.5);
        });

        it('should score partial matches', () => {
            const score = scorer.scoreSemanticMatch('Your Email Address', 'email');
            expect(score).toBeGreaterThan(0.5);
        });

        it('should score keyword matches', () => {
            const score = scorer.scoreSemanticMatch('Phone Number', 'phone');
            expect(score).toBeGreaterThan(0.5);
        });

        it('should cap score at 0.95 for semantic', () => {
            const score = scorer.scoreSemanticMatch('email', 'email');
            expect(score).toBeLessThanOrEqual(0.95);
        });
    });

    describe('scoreNameMatch', () => {
        it('should give perfect score for exact name match', () => {
            const score = scorer.scoreNameMatch('email', 'email');
            expect(score).toBe(1.0);
        });

        it('should normalize underscores and hyphens', () => {
            const score1 = scorer.scoreNameMatch('email_address', 'emailAddress');
            const score2 = scorer.scoreNameMatch('email-address', 'emailAddress');
            expect(score1).toBeGreaterThan(0.5);
            expect(score2).toBeGreaterThan(0.5);
        });

        it('should score partial matches', () => {
            const score = scorer.scoreNameMatch('email', 'emailAddress');
            expect(score).toBeGreaterThan(0.5);
        });

        it('should use string similarity for fuzzy matches', () => {
            const score = scorer.scoreNameMatch('emial', 'email');
            expect(score).toBeGreaterThan(0.5);
        });

        it('should score poorly for unrelated names', () => {
            const score = scorer.scoreNameMatch('phone', 'address');
            expect(score).toBeLessThan(0.5);
        });
    });

    describe('scoreTypeMatch', () => {
        it('should give perfect score for exact type match', () => {
            const score = scorer.scoreTypeMatch('email', 'email');
            expect(score).toBe(1.0);
        });

        it('should match equivalent types', () => {
            const score = scorer.scoreTypeMatch('tel', 'phone');
            expect(score).toBeGreaterThan(0.8);
        });

        it('should score type mismatches lower', () => {
            const score = scorer.scoreTypeMatch('text', 'email');
            expect(score).toBeLessThan(0.6);
        });

        it('should handle unknown expected types', () => {
            const score = scorer.scoreTypeMatch('text', 'customType');
            expect(score).toBeGreaterThan(0);
        });
    });

    describe('scoreContextMatch', () => {
        it('should score high for matching context', () => {
            const score = scorer.scoreContextMatch('Enter your phone number', 'phone');
            expect(score).toBeGreaterThan(0.3);
        });

        it('should score low for unrelated context', () => {
            const score = scorer.scoreContextMatch('Submit your application', 'phone');
            expect(score).toBeLessThan(0.3);
        });

        it('should handle empty context', () => {
            const score = scorer.scoreContextMatch('', 'email');
            expect(score).toBe(0);
        });

        it('should be case-insensitive', () => {
            const score = scorer.scoreContextMatch('YOUR EMAIL', 'email');
            expect(score).toBeGreaterThan(0);
        });
    });

    describe('classifyConfidence', () => {
        it('should classify high confidence', () => {
            const classification = scorer.classifyConfidence(0.90);
            expect(classification.level).toBe('high');
            expect(classification.action).toBe('auto_fill');
        });

        it('should classify medium confidence', () => {
            const classification = scorer.classifyConfidence(0.70);
            expect(classification.level).toBe('medium');
            expect(classification.action).toBe('confirm');
        });

        it('should classify low confidence', () => {
            const classification = scorer.classifyConfidence(0.50);
            expect(classification.level).toBe('low');
            expect(classification.action).toBe('skip');
        });

        it('should be at threshold for high', () => {
            const classification = scorer.classifyConfidence(0.85);
            expect(classification.level).toBe('high');
        });

        it('should be at threshold for medium', () => {
            const classification = scorer.classifyConfidence(0.60);
            expect(classification.level).toBe('medium');
        });
    });

    describe('scoreFieldMatch', () => {
        it('should score and classify field match', () => {
            const fieldInfo = {
                label: 'Email Address',
                name: 'email',
                type: 'email',
                context: 'Enter your contact email'
            };

            const result = scorer.scoreFieldMatch(fieldInfo, 'email', 'user@example.com');

            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('scores');
            expect(result).toHaveProperty('classification');
            expect(result).toHaveProperty('recommendation');
        });

        it('should have high confidence for email field', () => {
            const fieldInfo = {
                label: 'Email Address',
                name: 'email',
                type: 'email',
                context: 'Email'
            };

            const result = scorer.scoreFieldMatch(fieldInfo, 'email', 'user@example.com');
            expect(result.confidence).toBeGreaterThan(0.80);
        });

        it('should record score in history', () => {
            const fieldInfo = {
                label: 'Phone',
                name: 'phone',
                type: 'tel',
                context: ''
            };

            scorer.scoreFieldMatch(fieldInfo, 'phone', '+1234567890');
            expect(scorer.scoringHistory.length).toBe(1);
        });
    });

    describe('calculateStringSimilarity', () => {
        it('should give 1.0 for identical strings', () => {
            const similarity = scorer.calculateStringSimilarity('email', 'email');
            expect(similarity).toBe(1.0);
        });

        it('should give 0.0 for completely different strings', () => {
            const similarity = scorer.calculateStringSimilarity('abc', 'xyz');
            expect(similarity).toBe(0);
        });

        it('should handle one-character difference', () => {
            const similarity = scorer.calculateStringSimilarity('email', 'emial');
            expect(similarity).toBeGreaterThan(0.6);
        });

        it('should handle case sensitivity', () => {
            const similarity = scorer.calculateStringSimilarity('Email', 'email');
            expect(similarity).toBeLessThan(1.0);
        });
    });

    describe('scoreAndRankMatches', () => {
        it('should rank matches by confidence', () => {
            const fieldInfo = {
                label: 'Email',
                name: 'email',
                type: 'email',
                context: 'Email'
            };

            const possibleMatches = [
                { key: 'phone', data: '+1234567890' },
                { key: 'email', data: 'user@example.com' },
                { key: 'address', data: '123 Main St' }
            ];

            const ranked = scorer.scoreAndRankMatches(fieldInfo, possibleMatches);

            expect(ranked[0].profileKey).toBe('email');
            expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence);
        });

        it('should return all matches', () => {
            const fieldInfo = {
                label: 'Test',
                name: 'test',
                type: 'text',
                context: ''
            };

            const possibleMatches = [
                { key: 'field1', data: 'value1' },
                { key: 'field2', data: 'value2' },
                { key: 'field3', data: 'value3' }
            ];

            const ranked = scorer.scoreAndRankMatches(fieldInfo, possibleMatches);
            expect(ranked.length).toBe(3);
        });
    });

    describe('getBestMatch', () => {
        it('should return best match above threshold', () => {
            const fieldInfo = {
                label: 'Email Address',
                name: 'email',
                type: 'email',
                context: 'Email'
            };

            const possibleMatches = [
                { key: 'phone', data: '+1234567890' },
                { key: 'email', data: 'user@example.com' }
            ];

            const best = scorer.getBestMatch(fieldInfo, possibleMatches, 0.5);
            expect(best.profileKey).toBe('email');
        });

        it('should return null if no matches above threshold', () => {
            const fieldInfo = {
                label: 'Unknown Field',
                name: 'unknownField',
                type: 'text',
                context: ''
            };

            const possibleMatches = [
                { key: 'phone', data: '+1234567890' }
            ];

            const best = scorer.getBestMatch(fieldInfo, possibleMatches, 0.95);
            expect(best).toBeNull();
        });
    });

    describe('setThresholds', () => {
        it('should update thresholds', () => {
            scorer.setThresholds({ high: 0.90, medium: 0.70 });
            
            expect(scorer.thresholds.high).toBe(0.90);
            expect(scorer.thresholds.medium).toBe(0.70);
        });

        it('should preserve unchanged thresholds', () => {
            scorer.setThresholds({ high: 0.90 });
            
            expect(scorer.thresholds.high).toBe(0.90);
            expect(scorer.thresholds.medium).toBe(0.60); // unchanged
        });
    });

    describe('setWeights', () => {
        it('should update weights', () => {
            const newWeights = {
                semantic: 0.50,
                nameMatch: 0.25,
                typeMatch: 0.15,
                contextMatch: 0.10
            };

            scorer.setWeights(newWeights);
            expect(scorer.weights).toEqual(newWeights);
        });

        it('should throw error if weights do not sum to 1', () => {
            const invalidWeights = {
                semantic: 0.50,
                nameMatch: 0.25,
                typeMatch: 0.15,
                contextMatch: 0.05 // Sum = 0.95
            };

            expect(() => scorer.setWeights(invalidWeights)).toThrow();
        });
    });

    describe('getScoringStatistics', () => {
        it('should return null for empty history', () => {
            const stats = scorer.getScoringStatistics();
            expect(stats).toBeNull();
        });

        it('should calculate statistics from history', () => {
            // Add some scores
            for (let i = 0; i < 5; i++) {
                scorer.recordScore({
                    confidence: 0.5 + (i * 0.1),
                    classification: { level: i > 2 ? 'high' : 'low' }
                });
            }

            const stats = scorer.getScoringStatistics();
            expect(stats).toHaveProperty('average');
            expect(stats).toHaveProperty('median');
            expect(stats).toHaveProperty('min');
            expect(stats).toHaveProperty('max');
            expect(stats).toHaveProperty('levelCounts');
        });

        it('should calculate percentages', () => {
            scorer.recordScore({ confidence: 0.9, classification: { level: 'high' } });
            scorer.recordScore({ confidence: 0.7, classification: { level: 'medium' } });
            scorer.recordScore({ confidence: 0.4, classification: { level: 'low' } });

            const stats = scorer.getScoringStatistics();
            expect(stats.levelPercentages.high).toContain('%');
        });
    });

    describe('scoreForm', () => {
        it('should score entire form', () => {
            const fields = [
                { label: 'Email', name: 'email', type: 'email', context: 'Email' },
                { label: 'Phone', name: 'phone', type: 'tel', context: 'Phone' }
            ];

            const profileData = {
                email: 'user@example.com',
                phone: '+1234567890'
            };

            const result = scorer.scoreForm(fields, profileData);
            expect(result).toHaveProperty('totalFields', 2);
            expect(result).toHaveProperty('matchedFields');
            expect(result).toHaveProperty('averageConfidence');
        });

        it('should classify form by average confidence', () => {
            const fields = [
                { label: 'Email', name: 'email', type: 'email', context: 'Email' }
            ];

            const profileData = {
                email: 'user@example.com'
            };

            const result = scorer.scoreForm(fields, profileData);
            expect(result.formClassification).toHaveProperty('level');
            expect(result.formClassification).toHaveProperty('action');
        });
    });

    describe('history management', () => {
        it('should record scores in history', () => {
            const score = {
                confidence: 0.8,
                classification: { level: 'high' }
            };

            scorer.recordScore(score);
            expect(scorer.scoringHistory.length).toBe(1);
            expect(scorer.scoringHistory[0]).toHaveProperty('timestamp');
        });

        it('should limit history to 1000 entries', () => {
            for (let i = 0; i < 1100; i++) {
                scorer.recordScore({
                    confidence: Math.random(),
                    classification: { level: 'high' }
                });
            }

            expect(scorer.scoringHistory.length).toBe(1000);
        });

        it('should reset history', () => {
            scorer.recordScore({ confidence: 0.8, classification: { level: 'high' } });
            scorer.resetHistory();
            expect(scorer.scoringHistory.length).toBe(0);
        });
    });

    describe('getConfidenceDistribution', () => {
        it('should return null for empty history', () => {
            const distribution = scorer.getConfidenceDistribution();
            expect(distribution).toBeNull();
        });

        it('should calculate distribution of confidence scores', () => {
            scorer.recordScore({ confidence: 0.98, classification: { level: 'high' } });
            scorer.recordScore({ confidence: 0.90, classification: { level: 'high' } });
            scorer.recordScore({ confidence: 0.70, classification: { level: 'medium' } });
            scorer.recordScore({ confidence: 0.50, classification: { level: 'low' } });

            const distribution = scorer.getConfidenceDistribution();
            expect(distribution.veryHigh).toBe(1);
            expect(distribution.high).toBe(1);
            expect(distribution.medium).toBe(1);
            expect(distribution.low).toBe(1);
        });
    });

    describe('estimateSuccessRate', () => {
        it('should estimate success rate from form scores', () => {
            const formScores = [
                { formClassification: { level: 'high' } },
                { formClassification: { level: 'high' } },
                { formClassification: { level: 'medium' } },
                { formClassification: { level: 'low' } }
            ];

            const rate = scorer.estimateSuccessRate(formScores);
            expect(rate).toBe(75); // 3 out of 4 = 75%
        });

        it('should return 0 for empty scores', () => {
            const rate = scorer.estimateSuccessRate([]);
            expect(rate).toBe(0);
        });
    });
});
