// api/gemini.js — Gemini AI Proxy (v9) — gemini-2.0-flash + 30-question quiz mode
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { prompt, context, mode } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'A prompt is required.' });

  try {
    const keyRes = await fetch('http://34.172.204.106:3000/key');
    if (!keyRes.ok) throw new Error('Unable to retrieve API key from key server.');
    const { key } = await keyRes.json();
    if (!key) throw new Error('API key missing or not configured.');

    // Build the full prompt
    const finalPrompt = context
      ? `Scripture Context:\n${context}\n\nTask:\n${prompt}`
      : prompt;

    // Use gemini-2.0-flash for all requests (fast, capable)
    const MODEL = 'gemini-2.0-flash';

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: mode === 'quiz' ? 0.9 : 0.5,
            maxOutputTokens: mode === 'quiz' ? 8192 : 1024
          }
        })
      }
    );

    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini API error ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const reply  = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    if (!reply) return res.status(502).json({ error: 'AI returned empty response.' });

    return res.json({ reply });
  } catch (e) {
    console.error('[api/gemini]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
