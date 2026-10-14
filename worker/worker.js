// Cloudflare Worker de COVIDE: responde consultas interpretando los documentos y guarda actas/otros documentos.
// Variables: ANTHROPIC_API_KEY (secret), ACCESS_CODE (socios), ADMIN_CODE (quien carga documentos),
// ALLOWED_ORIGIN (https://usuario.github.io), SITE_URL (https://usuario.github.io/repo), MODEL / MODEL_OCR (opcionales).
// Binding KV: DOCS.
const NAMES = { reg: 'Reglamento de Convivencia', est: 'Estatuto' };
const SYS = `Sos el asistente de la cooperativa de vivienda COVIDE (Cerro, Montevideo). Respondés consultas de socios interpretando el Reglamento de Convivencia, el Estatuto y los demás documentos que se entregan (actas de asamblea, etc.).
Primero entendé qué quiere saber la persona aunque lo diga con otras palabras; después elaborá una respuesta propia, clara y breve (2 a 6 oraciones) en español rioplatense, sin copiar los artículos enteros.
Basate SOLO en los documentos. Si dos documentos se contradicen, o un acta más reciente cambia algo, indicalo. Si los documentos no lo resuelven, decilo y sugerí consultar al Consejo Directivo. No des asesoramiento legal.
Devolvé SOLO un JSON: {"answer":"...","citations":[{"doc":"Reglamento de Convivencia | Estatuto | título exacto del documento","ref":"número de artículo, ej. 19 o 40–50 (vacío si no aplica)","quote":"cita textual breve, máximo 40 palabras, copiada del documento"}]}. Incluí de 1 a 4 citas que respalden la respuesta.`;

async function claude(env, body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return ((await r.json()).content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
}
const getDocs = async env => (await env.DOCS.get('docs', 'json')) || [];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*', 'Access-Control-Allow-Headers': 'content-type,x-code', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' };
    const out = (b, s = 200) => new Response(b == null ? null : typeof b === 'string' ? b : JSON.stringify(b), { status: s, headers: typeof b === 'object' && b ? { ...cors, 'content-type': 'application/json' } : cors });
    try {
      if (req.method === 'OPTIONS') return out(null, 204);
      if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return out('forbidden', 403);
      const path = new URL(req.url).pathname.replace(/\/$/, '') || '/', code = req.headers.get('x-code') || '';
      const admin = !!env.ADMIN_CODE && code === env.ADMIN_CODE;
      const member = admin || !env.ACCESS_CODE || code === env.ACCESS_CODE;

      if (path === '/docs' && req.method === 'GET') return member ? out({ docs: await getDocs(env) }) : out('code', 401);

      if (path === '/ask' && req.method === 'POST') {
        if (!member) return out('code', 401);
        const q = String((await req.json()).q || '').slice(0, 600);
        if (!q) return out('bad', 400);
        const base = await (await fetch(env.SITE_URL.replace(/\/$/, '') + '/data.json', { cf: { cacheTtl: 300, cacheEverything: true } })).json();
        const baseTxt = base.map(a => `[${NAMES[a.doc]} · Art. ${a.num} – ${a.title}]\n${a.text}`).join('\n\n');
        let extra = '';
        for (const d of (await getDocs(env)).slice().reverse()) {
          const t = `[DOCUMENTO: ${d.title}${d.date ? ' · ' + d.date : ''}]\n${d.text}\n\n`;
          if (extra.length + t.length > 150000) break;
          extra += t;
        }
        const text = await claude(env, {
          model: env.MODEL || 'claude-haiku-5-5', max_tokens: 900,
          system: [{ type: 'text', text: SYS }, { type: 'text', text: 'DOCUMENTOS BASE:\n\n' + baseTxt + (extra ? '\n\nOTROS DOCUMENTOS (más recientes primero):\n\n' + extra : ''), cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: q }]
        });
        try {
          const j = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
          return out({ answer: String(j.answer || ''), citations: (j.citations || []).slice(0, 4).map(c => ({ doc: String(c.doc || ''), ref: String(c.ref || ''), quote: String(c.quote || '') })) });
        } catch { return out({ answer: text, citations: [] }); }
      }

      if (path === '/transcribe' && req.method === 'POST') {
        if (!admin) return out('code', 401);
        const { files } = await req.json();
        const content = (files || []).slice(0, 12).map(f => f.type === 'pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
          : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
        content.push({ type: 'text', text: 'Transcribí fielmente TODO el texto de estas páginas, en orden, en español. Conservá la numeración, los títulos y los párrafos. No resumas ni agregues comentarios. Si algo es ilegible escribí [ilegible]. Devolvé solo el texto.' });
        return out({ text: await claude(env, { model: env.MODEL_OCR || 'claude-sonnet-5-5', max_tokens: 8000, messages: [{ role: 'user', content }] }) });
      }

      if (path === '/docs' && req.method === 'POST') {
        if (!admin) return out('code', 401);
        const b = await req.json(), docs = await getDocs(env);
        if (!b.title || !b.text || docs.length >= 60) return out('bad', 400);
        docs.push({ id: crypto.randomUUID(), title: String(b.title).slice(0, 120), date: String(b.date || '').slice(0, 10), text: String(b.text).slice(0, 150000), added: Date.now() });
        await env.DOCS.put('docs', JSON.stringify(docs));
        return out({ ok: true });
      }

      if (path.startsWith('/docs/') && req.method === 'DELETE') {
        if (!admin) return out('code', 401);
        const id = path.slice(6);
        await env.DOCS.put('docs', JSON.stringify((await getDocs(env)).filter(d => d.id !== id)));
        return out({ ok: true });
      }
      return out('not found', 404);
    } catch (e) { return out('error', 502); }
  }
};
