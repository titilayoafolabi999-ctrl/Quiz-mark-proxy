// api/chat.js — Group Chat Proxy (Vercel Serverless Function)
const BASE = 'http://34.172.204.106:3000';

export default async function handler(req, res) {
  // Allow CORS from the frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const since = req.query.since || '0';
      const upstream = await fetch(`${BASE}/api/chat?since=${encodeURIComponent(since)}`);
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: 'Chat service is temporarily unavailable.' });
      }
      const data = await upstream.json();
      return res.json(data);
    }

    if (req.method === 'POST') {
      const upstream = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      if (!upstream.ok) {
        const errData = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json(errData);
      }
      const data = await upstream.json();
      return res.json(data);
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    console.error('[api/chat] Error:', e.message);
    return res.status(500).json({ error: 'Chat service is temporarily unavailable.' });
  }
}
