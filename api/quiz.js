// api/quiz.js — Quiz CRUD Proxy (v9)
const BASE = 'http://34.172.204.106:3000';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Strip /api/quiz prefix to get the sub-path
  const sub = (req.url || '').replace(/^\/api\/quiz/, '') || '/';

  try {
    if (req.method === 'GET') {
      const up = await fetch(`${BASE}/api/quiz${sub}`);
      if (!up.ok) return res.status(up.status).json(await up.json().catch(() => ({ error: 'Error' })));
      return res.json(await up.json());
    }
    if (req.method === 'POST') {
      const up = await fetch(`${BASE}/api/quiz${sub}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await up.json().catch(() => ({}));
      return res.status(up.status).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    console.error('[api/quiz]', e.message);
    return res.status(500).json({ error: 'Quiz service unavailable.' });
  }
}
