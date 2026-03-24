export default async function handler(req,res) {
  try {
    const r = await fetch('http://34.172.204.106:3000/auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(req.body)
    });
    const d = await r.json();
    res.json(d);
  } catch(e) {
    res.status(500).json({error: e.message});
  }
}
