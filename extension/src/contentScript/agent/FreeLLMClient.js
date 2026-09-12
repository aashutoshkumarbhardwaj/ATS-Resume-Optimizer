/**
 * Free LLM Client
 * Connects to 100% free AI model providers:
 * 1. Google Gemini 1.5 Flash (Google AI Studio Free Tier: 15 RPM, 1M TPM, 1500 RPD)
 * 2. Groq Cloud (LLaMA 3.3 70B / 8B Free Tier: 30 RPM, 14.4k RPD, 800 tokens/sec)
 * 3. Chrome Built-in AI (window.ai / Gemini Nano: 100% local, $0 cost, zero API keys)
 */

class FreeLLMClient {
    constructor(config = {}) {
        this.provider = config.provider || 'gemini'; // 'gemini' | 'groq' | 'window_ai' | 'offline'
        this.geminiApiKey = config.geminiApiKey || '';
        this.groqApiKey = config.groqApiKey || '';
        this.timeoutMs = config.timeoutMs || 7000;
    }

    /**
     * Set active provider and API keys
     */
    configure({ provider, geminiApiKey, groqApiKey }) {
        if (provider) this.provider = provider;
        if (geminiApiKey !== undefined) this.geminiApiKey = geminiApiKey;
        if (groqApiKey !== undefined) this.groqApiKey = groqApiKey;
    }

    /**
     * Check if Chrome's built-in on-device AI is available
     */
    async hasChromeBuiltInAI() {
        if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
            try {
                const capabilities = await window.ai.languageModel.capabilities();
                return capabilities.available === 'readily';
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    /**
     * Main prompt completion method
     */
    async complete(systemPrompt, userPrompt) {
        // Try active provider
        try {
            if (this.provider === 'window_ai' || (!this.geminiApiKey && !this.groqApiKey)) {
                const canUseLocal = await this.hasChromeBuiltInAI();
                if (canUseLocal) {
                    console.log('[FreeLLMClient] 💻 Using Chrome Built-in AI (Gemini Nano)');
                    return await this.callChromeBuiltInAI(systemPrompt, userPrompt);
                }
            }

            if (this.provider === 'groq' && this.groqApiKey) {
                console.log('[FreeLLMClient] ⚡ Using Groq LLaMA 3.3 (Free Tier)');
                return await this.callGroq(systemPrompt, userPrompt);
            }

            if (this.geminiApiKey) {
                console.log('[FreeLLMClient] 🌐 Using Google Gemini 1.5 Flash (Free Tier)');
                return await this.callGemini(systemPrompt, userPrompt);
            }

            if (this.groqApiKey) {
                console.log('[FreeLLMClient] ⚡ Fallback to Groq LLaMA');
                return await this.callGroq(systemPrompt, userPrompt);
            }

            console.warn('[FreeLLMClient] ⚠️ No API key or local model available. Operating in rule-based offline mode.');
            return null;
        } catch (error) {
            console.error('[FreeLLMClient] ❌ Generation error:', error);
            return null;
        }
    }

    /**
     * Call Google Gemini 1.5 Flash REST API (Free Tier)
     */
    async callGemini(systemPrompt, userPrompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;

        const payload = {
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: userPrompt }]
                }
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 400
            }
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Gemini API error ${res.status}: ${err}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            return text ? text.trim() : null;
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    }

    /**
     * Call Groq Cloud API with LLaMA 3.3 70B (Free Tier)
     */
    async callGroq(systemPrompt, userPrompt) {
        const url = 'https://api.groq.com/openai/v1/chat/completions';

        const payload = {
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 400
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.groqApiKey}`
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Groq API error ${res.status}: ${err}`);
            }

            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content;
            return text ? text.trim() : null;
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    }

    /**
     * Call Chrome Built-in AI (window.ai.languageModel)
     */
    async callChromeBuiltInAI(systemPrompt, userPrompt) {
        try {
            const session = await window.ai.languageModel.create({
                systemPrompt: systemPrompt
            });
            const result = await session.prompt(userPrompt);
            session.destroy();
            return result ? result.trim() : null;
        } catch (err) {
            console.error('[FreeLLMClient] Chrome Built-in AI prompt failed:', err);
            return null;
        }
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.FreeLLMClient = FreeLLMClient;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FreeLLMClient;
}
