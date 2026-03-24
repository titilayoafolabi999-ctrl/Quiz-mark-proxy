// api/auth.js — Authentication Proxy (Vercel Serverless Function)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const upstream = await fetch('http://34.172.204.106:3000/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Authentication service is temporarily unavailable.' });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (e) {
    console.error('[api/auth] Error:', e.message);
    return res.status(500).json({ error: 'A server error occurred. Please try again.' });
  }
}
