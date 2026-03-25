// api/misc.js — Leaderboard / Bookmarks / Notes / Streak / Ping (v9)
const BASE = 'http://34.172.204.106:3000';

async function proxy(url, method, body, res) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const up   = await fetch(`${BASE}${url}`, opts);
  const data = await up.json().catch(() => ({}));
  return res.status(up.status).json(data);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.url.split('?')[0].replace(/^\/api/, '');

  try {
    return await proxy(
      `/api${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`,
      req.method, req.method === 'POST' ? req.body : null, res
    );
  } catch (e) {
    console.error('[api/misc]', e.message);
    return res.status(500).json({ error: 'Service unavailable.' });
  }
}
