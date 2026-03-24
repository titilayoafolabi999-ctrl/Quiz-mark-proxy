// api/score.js — Score Proxy (Vercel Serverless Function)
export default async function handler(req, res) {
  const BASE = 'http://34.172.204.106:3000';

  try {
    if (req.method === 'GET') {
      const { username } = req.query;
      if (!username) return res.status(400).json({ error: 'Username is required.' });

      const upstream = await fetch(`${BASE}/api/score?username=${encodeURIComponent(username)}`);
      const data = await upstream.json();
      return res.json(data);
    }

    if (req.method === 'POST') {
      const upstream = await fetch(`${BASE}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await upstream.json();
      return res.json(data);
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    console.error('[api/score] Error:', e.message);
    return res.status(500).json({ error: 'Score service is temporarily unavailable.' });
  }
}
