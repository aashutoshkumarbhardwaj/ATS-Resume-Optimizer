/**
 * Free LLM Client
 * Connects to high-precision AI model providers:
 * 1. Cloudflare Workers AI / Custom Cloudflare AI Worker (@cf/meta/llama-3.3-70b-instruct)
 * 2. Chrome Built-in AI (window.ai / Gemini Nano: 100% local, $0 cost, zero API keys)
 * 3. Groq Cloud (LLaMA 3.3 70B / 8B Free Tier: 30 RPM, 14.4k RPD, 800 tokens/sec)
 * 4. Google Gemini 1.5 Flash / 2.0 Flash (Google AI Studio Free Tier)
 */

class FreeLLMClient {
    constructor(config = {}) {
        this.provider = config.provider || 'cloudflare'; // 'cloudflare' | 'groq' | 'gemini' | 'window_ai' | 'offline'
        this.cfWorkerUrl = config.cfWorkerUrl || config.cloudflareWorkerUrl || '';
        this.cfAccountId = config.cfAccountId || config.cloudflareAccountId || '';
        this.cfApiToken = config.cfApiToken || config.cloudflareApiToken || '';
        this.cfModel = config.cfModel || '@cf/meta/llama-3.3-70b-instruct'; // Flagship reasoning & precision model
        this.geminiApiKey = config.geminiApiKey || '';
        this.groqApiKey = config.groqApiKey || '';
        this.backendProxyUrl = config.backendProxyUrl || (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id ? 'https://ats-resume-optimizer-359j.onrender.com/api/ai/generate' : '');
        this.timeoutMs = config.timeoutMs || 8000;
    }

    /**
     * Set active provider and API keys
     */
    configure({ provider, cfWorkerUrl, cfAccountId, cfApiToken, cfModel, geminiApiKey, groqApiKey }) {
        if (provider) this.provider = provider;
        if (cfWorkerUrl !== undefined) this.cfWorkerUrl = cfWorkerUrl;
        if (cfAccountId !== undefined) this.cfAccountId = cfAccountId;
        if (cfApiToken !== undefined) this.cfApiToken = cfApiToken;
        if (cfModel) this.cfModel = cfModel;
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
     * Main prompt completion method with high precision
     */
    async complete(systemPrompt, userPrompt) {
        try {
            // Priority 1: Cloudflare AI Worker (User specified or configured)
            if (this.provider === 'cloudflare' || this.cfWorkerUrl || (this.cfAccountId && this.cfApiToken)) {
                try {
                    const cfRes = await this.callCloudflareWorker(systemPrompt, userPrompt);
                    if (cfRes && cfRes.trim().length > 0) {
                        return cfRes.trim();
                    }
                } catch (cfErr) {
                    console.warn('[FreeLLMClient] ⚠️ Cloudflare Worker failed, checking fallbacks:', cfErr.message);
                }
            }

            // Priority 2: Chrome Built-in AI (Gemini Nano)
            if (this.provider === 'window_ai' || (!this.geminiApiKey && !this.groqApiKey && !this.cfWorkerUrl && !this.cfApiToken)) {
                const canUseLocal = await this.hasChromeBuiltInAI();
                if (canUseLocal) {
                    console.log('[FreeLLMClient] 💻 Using Chrome Built-in AI (Gemini Nano)');
                    return await this.callChromeBuiltInAI(systemPrompt, userPrompt);
                }
            }

            // Priority 3: Groq LLaMA 3.3 70B
            if (this.groqApiKey) {
                console.log('[FreeLLMClient] ⚡ Using Groq LLaMA 3.3 (High Precision)');
                return await this.callGroq(systemPrompt, userPrompt);
            }

            // Priority 4: Google Gemini 1.5/2.0 Flash
            if (this.geminiApiKey) {
                console.log('[FreeLLMClient] 🌐 Using Google Gemini Flash');
                return await this.callGemini(systemPrompt, userPrompt);
            }

            // Priority 5: Backend Cloudflare AI Worker Proxy (/api/ai/generate)
            if (this.backendProxyUrl) {
                try {
                    const proxyRes = await this.callBackendProxy(systemPrompt, userPrompt);
                    if (proxyRes && proxyRes.trim().length > 0) {
                        return proxyRes.trim();
                    }
                } catch (proxyErr) {
                    console.warn('[FreeLLMClient] ⚠️ Backend AI proxy unavailable:', proxyErr.message);
                }
            }

            console.warn('[FreeLLMClient] ⚠️ No AI provider configured or responsive. Falling back to dynamic candidate synthesizer.');
            return null;
        } catch (error) {
            console.error('[FreeLLMClient] ❌ Generation error:', error);
            return null;
        }
    }

    /**
     * Call Cloudflare AI Worker or Cloudflare Workers AI Gateway
     */
    async callCloudflareWorker(systemPrompt, userPrompt) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            // Option 1: Custom Cloudflare AI Worker URL (e.g. https://my-worker.subdomain.workers.dev)
            if (this.cfWorkerUrl) {
                console.log(`[FreeLLMClient] ☁️ Calling Cloudflare AI Worker: ${this.cfWorkerUrl}`);
                const payload = {
                    prompt: userPrompt,
                    systemPrompt: systemPrompt,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    model: this.cfModel,
                    temperature: 0.1, // Maximum precision, minimal hallucination
                    max_tokens: 500
                };

                const headers = { 'Content-Type': 'application/json' };
                if (this.cfApiToken) {
                    headers['Authorization'] = `Bearer ${this.cfApiToken}`;
                }

                const res = await fetch(this.cfWorkerUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`Cloudflare Worker HTTP ${res.status}: ${err}`);
                }

                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const data = await res.json();
                    const text = data?.response || 
                                 data?.result?.response || 
                                 data?.result || 
                                 data?.output || 
                                 data?.choices?.[0]?.message?.content || 
                                 data?.text;
                    if (text && typeof text === 'string' && text.trim().length > 0) {
                        return text.trim();
                    }
                } else {
                    const rawText = await res.text();
                    if (rawText && rawText.trim().length > 0) {
                        return rawText.trim();
                    }
                }
            }

            // Option 2: Cloudflare Workers AI Direct API
            if (this.cfAccountId && this.cfApiToken) {
                const model = this.cfModel || '@cf/meta/llama-3.3-70b-instruct';
                console.log(`[FreeLLMClient] ☁️ Calling Cloudflare Workers AI API (${model})...`);
                const url = `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/ai/run/${model}`;

                const payload = {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 500
                };

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.cfApiToken}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`Cloudflare Workers AI HTTP ${res.status}: ${err}`);
                }

                const data = await res.json();
                const text = data?.result?.response || data?.response;
                if (text && typeof text === 'string' && text.trim().length > 0) {
                    return text.trim();
                }
            }

            return null;
        } catch (e) {
            clearTimeout(timeout);
            console.warn('[FreeLLMClient] ⚠️ Cloudflare AI Worker invocation failed:', e.message);
            throw e;
        }
    }

    /**
     * Call Backend Cloudflare AI Worker Proxy (/api/ai/generate)
     */
    async callBackendProxy(systemPrompt, userPrompt) {
        if (!this.backendProxyUrl) return null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        try {
            const res = await fetch(this.backendProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPrompt,
                    userPrompt,
                    model: this.cfModel,
                    temperature: 0.1,
                    max_tokens: 500
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) return null;
            const data = await res.json();
            return data?.response ? String(data.response).trim() : null;
        } catch (e) {
            clearTimeout(timeout);
            return null;
        }
    }

    /**
     * Call Google Gemini REST API (Free Tier: 1.5 Flash / 2.0 Flash)
     */
    async callGemini(systemPrompt, userPrompt) {
        const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
        let lastError = null;

        for (const model of models) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

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
                    maxOutputTokens: 600
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
                    // If systemInstruction caused 400, retry without systemInstruction
                    if (res.status === 400 && payload.systemInstruction) {
                        const fallbackPayload = {
                            contents: [
                                {
                                    role: 'user',
                                    parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                                }
                            ],
                            generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
                        };
                        const retryRes = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(fallbackPayload)
                        });
                        if (retryRes.ok) {
                            const retryData = await retryRes.json();
                            const t = retryData?.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (t) return t.trim();
                        }
                    }
                    throw new Error(`Gemini API error ${res.status} on ${model}: ${err}`);
                }

                const data = await res.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text && text.trim().length > 0) {
                    return text.trim();
                }
            } catch (e) {
                clearTimeout(timeout);
                lastError = e;
                console.warn(`[FreeLLMClient] ⚠️ Failed attempt on model ${model}:`, e.message);
                // Continue to next model if available
            }
        }

        throw lastError || new Error('All Gemini model endpoints failed');
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

    /**
     * Multimodal Vision Completion (Set-of-Mark screenshot + goal)
     * Uses Cloudflare Vision AI (@cf/llama-3.2-11b-vision-instruct), Backend Vision Proxy, or Gemini Vision.
     */
    async completeWithVision(systemPrompt, userPrompt, imageBase64) {
        if (!imageBase64) return null;
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        // 1. Custom Cloudflare AI Worker with Vision
        if (this.cfWorkerUrl) {
            try {
                const res = await fetch(this.cfWorkerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.cfApiToken ? { 'Authorization': `Bearer ${this.cfApiToken}` } : {})
                    },
                    body: JSON.stringify({
                        prompt: userPrompt,
                        systemPrompt,
                        imageBase64: cleanBase64,
                        model: '@cf/llama-3.2-11b-vision-instruct',
                        temperature: 0.1,
                        max_tokens: 150
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    const text = data?.response || data?.result?.response || data?.result;
                    if (text && typeof text === 'string') return text.trim();
                }
            } catch (e) {
                console.warn('[FreeLLMClient] Vision worker call failed:', e.message);
            }
        }

        // 2. Backend Cloudflare Vision Proxy
        if (this.backendProxyUrl) {
            try {
                const res = await fetch(this.backendProxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemPrompt,
                        userPrompt,
                        imageBase64: cleanBase64,
                        model: '@cf/llama-3.2-11b-vision-instruct',
                        temperature: 0.1,
                        max_tokens: 150
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.response) return String(data.response).trim();
                }
            } catch (e) {}
        }

        // 3. Google Gemini Flash Vision fallback
        if (this.geminiApiKey) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [
                                { text: `${systemPrompt}\n\n${userPrompt}` },
                                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
                            ]
                        }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    const t = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (t) return t.trim();
                }
            } catch (e) {}
        }

        return null;
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.FreeLLMClient = FreeLLMClient;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FreeLLMClient;
}
