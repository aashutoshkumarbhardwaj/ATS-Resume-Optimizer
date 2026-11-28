/**
 * AI Reasoning & Cloudflare Worker Proxy Routes
 * Exposes POST /api/ai/generate to proxy candidate question reasoning
 * to Cloudflare Workers AI / Custom Cloudflare AI Worker using backend .env credentials.
 */
const express = require('express');
const router = express.Router();

router.post('/generate', async (req, res) => {
    try {
        const { systemPrompt, userPrompt, imageBase64, model, temperature = 0.1, max_tokens = 500 } = req.body || {};
        if (!userPrompt) {
            return res.status(400).json({ success: false, error: 'userPrompt is required' });
        }

        const cfWorkerUrl = process.env.CLOUDFLARE_WORKER_URL || process.env.CF_WORKER_URL || '';
        const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '';
        const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '';
        const cfModel = model || (imageBase64 ? '@cf/llama-3.2-11b-vision-instruct' : (process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct'));

        // 1. Custom Cloudflare Worker Endpoint
        if (cfWorkerUrl) {
            const headers = { 'Content-Type': 'application/json' };
            if (cfApiToken) headers['Authorization'] = `Bearer ${cfApiToken}`;

            const userContent = imageBase64
                ? [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } }
                ]
                : userPrompt;

            const cfRes = await fetch(cfWorkerUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    prompt: userPrompt,
                    systemPrompt: systemPrompt || '',
                    imageBase64: imageBase64 || undefined,
                    messages: [
                        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                        { role: 'user', content: userContent }
                    ],
                    model: cfModel,
                    temperature,
                    max_tokens
                })
            });

            if (cfRes.ok) {
                const ct = cfRes.headers.get('content-type') || '';
                const data = ct.includes('application/json') ? await cfRes.json() : { response: await cfRes.text() };
                const text = data?.response || data?.result?.response || data?.result || data?.output || data?.choices?.[0]?.message?.content;
                if (text && typeof text === 'string' && text.trim()) {
                    return res.json({ success: true, provider: 'cloudflare_worker', response: text.trim() });
                }
            }
        }

        // 2. Direct Cloudflare Workers AI REST API
        if (cfAccountId && cfApiToken) {
            const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${cfModel}`;
            const cfRes = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfApiToken}`
                },
                body: JSON.stringify({
                    messages: [
                        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                        { role: 'user', content: userPrompt }
                    ],
                    temperature,
                    max_tokens
                })
            });

            if (cfRes.ok) {
                const data = await cfRes.json();
                const text = data?.result?.response || data?.response;
                if (text && typeof text === 'string' && text.trim()) {
                    return res.json({ success: true, provider: 'cloudflare_workers_ai', response: text.trim() });
                }
            }
        }

        return res.status(503).json({
            success: false,
            error: 'No Cloudflare AI Worker credentials configured in backend/.env'
        });
    } catch (err) {
        console.error('[/api/ai/generate] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
