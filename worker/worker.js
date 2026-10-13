// Cloudflare Worker: recibe {q, ctx} de la app y consulta a Claude sin exponer la clave.
// Variables: ANTHROPIC_API_KEY (secreta), ACCESS_CODE (código de socios), ALLOWED_ORIGIN (ej. https://usuario.github.io), MODEL (opcional).
const SYSTEM = 'Sos el asistente de una cooperativa de vivienda uruguaya. Respondé SOLO con base en los fragmentos entregados, en español rioplatense, claro y en pocas líneas. Citá siempre documento y artículo (ej. "Estatuto, Art. 19"). Si los fragmentos no alcanzan, decilo y sugerí consultar al Consejo Directivo. Si el Reglamento y el Estatuto difieren, marcalo. No des asesoramiento legal.';
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*', 'Access-Control-Allow-Headers': 'content-type,x-code', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
    const out = (b, s = 200) => new Response(b, { status: s, headers: cors });
    if (req.method === 'OPTIONS') return out(null, 204);
    if (req.method !== 'POST' || (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN)) return out('forbidden', 403);
    if (env.ACCESS_CODE && req.headers.get('x-code') !== env.ACCESS_CODE) return out('code', 401);
    let b; try { b = await req.json(); } catch { return out('bad', 400); }
    const q = String(b.q || '').slice(0, 500), ctx = String(b.ctx || '').slice(0, 14000);
    if (!q || !ctx) return out('bad', 400);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODEL || 'claude-haiku-5-5', max_tokens: 600, system: SYSTEM, messages: [{ role: 'user', content: `Fragmentos:\n${ctx}\n\nPregunta: ${q}` }] })
    });
    if (!r.ok) return out('upstream', 502);
    const d = await r.json();
    const text = (d.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
    return new Response(JSON.stringify({ text }), { headers: { ...cors, 'content-type': 'application/json' } });
  }
};
