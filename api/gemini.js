// api/gemini.js — Gemini AI Proxy (Vercel Serverless Function)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { prompt, context } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'A prompt is required.' });
  }

  const finalPrompt = context
    ? `Scripture Context:\n${context}\n\nQuestion / Task:\n${prompt}`
    : prompt;

  try {
    // Retrieve API key from the key server
    const keyRes = await fetch('http://34.172.204.106:3000/key');
    if (!keyRes.ok) throw new Error('Unable to retrieve API key from the key server.');
    const { key } = await keyRes.json();
    if (!key) throw new Error('API key is missing or has not been configured.');

    // Call Gemini API
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 512
          }
        })
      }
    );

    if (!aiRes.ok) {
      const errBody = await aiRes.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Gemini API responded with status ${aiRes.status}.`);
    }

    const aiData = await aiRes.json();
    const reply = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!reply) {
      return res.status(502).json({ error: 'The AI model returned an empty response.' });
    }

    return res.json({ reply });
  } catch (e) {
    console.error('[api/gemini] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
