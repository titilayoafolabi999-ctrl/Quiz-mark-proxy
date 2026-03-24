export default async function handler(req,res) {
  const {prompt, context} = req.body;
  const finalPrompt = context ? `Context: ${context}\n${prompt}` : prompt;
  try {
    const keyRes = await fetch('http://34.172.204.106:3000/key');
    const {key} = await keyRes.json();
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:finalPrompt}]}]})
    });
    const d = await r.json();
    res.json({reply:d.candidates?.[0]?.content?.parts?.[0]?.text});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
}
