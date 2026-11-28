/**
 * SelfHealingResolver (Phase 6 - SELF-HEALING ELEMENT RESOLUTION)
 * Resolves semantic targets against live PageObserver snapshots using a 7-tier
 * evidence scoring model. Rejects low-confidence or ambiguous matches instead of guessing.
 */
var SelfHealingResolver = (typeof window !== 'undefined' && window.SelfHealingResolver) || class SelfHealingResolver {
    static MIN_CONFIDENCE = 0.55;

    static normalize(str) {
        return String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Resolve a semantic target descriptor { role, name, label, placeholder, nameAttr, contextText }
     * against observation.elements
     */
    static resolve(targetSpec = {}, observation) {
        if (!observation || !Array.isArray(observation.elements)) return null;

        const wantRole = this.normalize(targetSpec.role || '');
        const wantLabel = this.normalize(targetSpec.label || targetSpec.name || '');
        const wantPlaceholder = this.normalize(targetSpec.placeholder || '');
        const wantAttr = this.normalize(targetSpec.nameAttr || targetSpec.id || '');
        const wantContext = this.normalize(targetSpec.contextText || '');

        let best = null;
        let secondBestScore = 0;

        for (const item of observation.elements) {
            if (item.disabled) continue;

            let score = 0;
            const reasons = [];
            const itemRole = this.normalize(item.role);
            const itemLabel = this.normalize(item.label);
            const itemAcc = this.normalize(item.accessibleName);
            const itemPh = this.normalize(item.placeholder);
            const itemCtx = this.normalize(item.parentContext);

            // Tier 1: Exact accessible role & name
            if (wantRole && itemRole === wantRole) {
                score += 0.25;
                reasons.push('role_match');
            } else if (wantRole && wantRole !== 'generic' && itemRole !== wantRole) {
                continue; // Role mismatch guard
            }

            if (wantLabel) {
                if (itemAcc === wantLabel || itemLabel === wantLabel) {
                    score += 0.55;
                    reasons.push('exact_label_or_accessible_name');
                } else if (itemLabel.includes(wantLabel) || itemAcc.includes(wantLabel)) {
                    score += 0.38;
                    reasons.push('partial_label_match');
                }
            }

            // Tier 3: Placeholder
            if (wantPlaceholder && itemPh) {
                if (itemPh === wantPlaceholder) {
                    score += 0.3;
                    reasons.push('exact_placeholder');
                } else if (itemPh.includes(wantPlaceholder)) {
                    score += 0.18;
                    reasons.push('partial_placeholder');
                }
            }

            // Tier 4: Stable semantic attributes
            if (wantAttr && item.stableAttrs) {
                const attrValues = Object.values(item.stableAttrs).map((v) => this.normalize(v));
                if (attrValues.some((v) => v === wantAttr)) {
                    score += 0.35;
                    reasons.push('stable_attr_match');
                }
            }

            // Tier 5 & 6: Parent-child & nearby descriptive context
            if (wantContext && itemCtx && itemCtx.includes(wantContext)) {
                score += 0.15;
                reasons.push('context_match');
            }

            if (score > (best?.confidence || 0)) {
                secondBestScore = best ? best.confidence : 0;
                best = {
                    element: item.element,
                    entry: item,
                    confidence: Math.min(1, Number(score.toFixed(2))),
                    matchReason: reasons.join('+')
                };
            } else if (score > secondBestScore) {
                secondBestScore = score;
            }
        }

        if (!best || best.confidence < this.MIN_CONFIDENCE) {
            return null;
        }
        // Ambiguity guard: if two distinct elements tie closely below exact-match confidence, do not guess
        if (best.confidence < 0.85 && Math.abs(best.confidence - secondBestScore) < 0.05) {
            return { ...best, ambiguous: true };
        }
        return best;
    }
};

if (typeof window !== 'undefined') window.SelfHealingResolver = SelfHealingResolver;
if (typeof module !== 'undefined' && module.exports) module.exports = SelfHealingResolver;
