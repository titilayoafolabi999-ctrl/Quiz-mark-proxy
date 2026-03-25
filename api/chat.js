// api/chat.js — Chat Proxy with typing & reactions (v9)
const BASE = 'http://34.172.204.106:3000';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.split('?')[0];

  try {
    // Typing: GET /api/chat/typing  POST /api/chat/typing
    if (url.endsWith('/typing')) {
      if (req.method === 'GET') {
        const exclude = req.query.exclude || '';
        const up = await fetch(`${BASE}/api/chat/typing?exclude=${encodeURIComponent(exclude)}`);
        return res.json(await up.json());
      }
      if (req.method === 'POST') {
        const up = await fetch(`${BASE}/api/chat/typing`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
        });
        return res.json(await up.json());
      }
    }

    // Reactions: POST /api/chat/react
    if (url.endsWith('/react') && req.method === 'POST') {
      const up = await fetch(`${BASE}/api/chat/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      return res.json(await up.json());
    }

    // Main chat: GET  POST
    if (req.method === 'GET') {
      const since = req.query.since || '0';
      const up = await fetch(`${BASE}/api/chat?since=${encodeURIComponent(since)}`);
      if (!up.ok) return res.status(up.status).json({ error: 'Chat unavailable.' });
      return res.json(await up.json());
    }

    if (req.method === 'POST') {
      const up = await fetch(`${BASE}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await up.json();
      if (!up.ok) return res.status(up.status).json(data);
      return res.json(data);
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    console.error('[api/chat]', e.message);
    return res.status(500).json({ error: 'Chat service unavailable.' });
  }
}
