(async () => {
  const CFG = window.COVIDE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const DOC = { reg: 'Reglamento', est: 'Estatuto' };
  const SYS = 'Sos el asistente de una cooperativa de vivienda uruguaya. Respondé SOLO con base en los fragmentos entregados, en español rioplatense, claro y en pocas líneas. Citá siempre documento y artículo (ej. "Estatuto, Art. 19"). Si los fragmentos no alcanzan, decilo y sugerí consultar al Consejo Directivo. Si el Reglamento y el Estatuto difieren, marcalo. No des asesoramiento legal.';
  const QS = ['¿Hasta qué hora puedo poner música?', '¿Puedo tener mascotas?', '¿Cuánto cuesta alquilar el salón?', '¿Puedo hacer una reforma en mi casa?', '¿Cuándo me pueden excluir de la cooperativa?', '¿Qué pasa si me atraso con las cuotas?', '¿Cómo se convoca a una Asamblea?', '¿Qué hago si quiero renunciar?'];

  let DATA;
  try { DATA = window.COVIDE_DATA || await (await fetch('data.json')).json(); }
  catch (e) { document.body.innerHTML = '<p style="padding:24px;font:16px system-ui">No se pudieron cargar los documentos. Revisá tu conexión y recargá la página.</p>'; return; }
  const IX = Covide.build(DATA);

  /* tema */
  const root = document.documentElement;
  if (store.get('theme')) root.dataset.theme = store.get('theme');
  $('#theme').onclick = () => {
    const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    const n = cur === 'dark' ? 'light' : 'dark';
    root.dataset.theme = n; store.set('theme', n);
  };

  /* instalación */
  let ip;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; $('#inst').hidden = false; });
  $('#inst').onclick = async () => { ip.prompt(); await ip.userChoice; $('#inst').hidden = true; };
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }

  /* helpers de render */
  const hl = (t, qs) => esc(t).replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g, w => (qs && qs.has(Covide.stem(Covide.norm(w)))) ? `<mark>${w}</mark>` : w);
  const paras = (t, qs) => t.split('\n').filter(Boolean).map(x => `<p>${hl(x, qs)}</p>`).join('');
  const plate = a => `<div class="plate${String(a.num).length > 3 ? ' w' : ''}"><small>${/^\d/.test(a.num) ? 'Art.' : ''}</small><b>${esc(a.num)}</b><small>${DOC[a.doc]}</small></div>`;
  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  function card(r, qs) {
    const a = DATA[r.ai], partial = r.t && r.t !== a.text;
    const pre = r.t ? (a.text.indexOf(r.t) > 0 ? '… ' : '') + r.t + (a.text.trim().endsWith(r.t.trim()) ? '' : ' …') : a.text;
    return `<article class="art" data-i="${r.ai}">${plate(a)}<div><h3>${esc(a.title)}</h3>
      <div class="tx pv">${paras(pre, qs)}</div><div class="tx fl" hidden>${paras(a.text, qs)}</div>
      <div class="acts">${partial ? '<button data-a="more">Leer artículo completo</button>' : ''}<button data-a="copy">Copiar</button></div></div></article>`;
  }

  /* IA opcional: Worker propio (GitHub) o Claude (vista previa en claude.ai) */
  async function ai(q, ctx) {
    if (CFG.AI_ENDPOINT) {
      const r = await fetch(CFG.AI_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', 'x-code': store.get('code') || '' }, body: JSON.stringify({ q, ctx }) });
      if (r.status === 401) {
        const c = prompt('Ingresá el código de socios para ver respuestas redactadas:');
        if (!c) return null;
        store.set('code', c); return ai(q, ctx);
      }
      if (!r.ok) throw 0;
      return (await r.json()).text;
    }
    if (window.claude) {
      const s = await claude.use('sample');
      if (s) return (await s(SYS + '\n\nFragmentos:\n' + ctx + '\n\nPregunta: ' + q, { cache: false, modelTier: 'quick' })).text;
    }
    return null;
  }

  /* vistas */
  const chat = $('#chat'), scroller = $('#scroll');
  function show(v) {
    $('#vchat').hidden = v !== 'chat'; $('#vdocs').hidden = v !== 'docs'; $('#f').hidden = v !== 'chat'; $('.fine').hidden = v !== 'chat';
    document.querySelectorAll('.main button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
  }
  document.querySelectorAll('.main button').forEach(b => b.onclick = () => show(b.dataset.v));

  function add(html, cls) {
    const d = document.createElement('div'); d.className = cls; d.innerHTML = html;
    chat.appendChild(d); scroller.scrollTop = scroller.scrollHeight; return d;
  }

  async function ask(q) {
    q = q.trim(); if (!q) return;
    show('chat'); $('#hero').hidden = true; add(esc(q), 'msg u');
    const r = Covide.search(IX, q).res, qs = new Set(Covide.toks(q)), canAI = !!(CFG.AI_ENDPOINT || window.claude);
    if (!r.length) {
      add('No encontré nada claro sobre eso en el Reglamento ni en el Estatuto. Probá con otras palabras (por ejemplo "mascotas", "salón", "cuotas") o consultá al Consejo Directivo.', 'msg plain');
      return;
    }
    const m = add((canAI ? '<div class="ans">Redactando respuesta…</div>' : '<p class="lead">Esto dicen los documentos:</p>') + r.map(x => card(x, qs)).join(''), 'msg');
    if (!canAI) return;
    const el = $('.ans', m);
    try {
      const ctx = r.map(x => { const a = DATA[x.ai]; return `[${DOC[a.doc]}, Art. ${a.num} – ${a.title}]\n${a.text.slice(0, 3000)}`; }).join('\n\n');
      const t = await ai(q, ctx);
      if (t) { el.innerHTML = fmt(t); el.insertAdjacentHTML('afterend', '<p class="src">Dónde lo dice:</p>'); }
      else { el.className = 'lead'; el.textContent = 'Esto dicen los documentos:'; }
    } catch (e) { el.className = 'lead'; el.textContent = 'No pude redactar la respuesta ahora. Esto dicen los documentos:'; }
    scroller.scrollTop = scroller.scrollHeight;
  }

  chat.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const c = b.closest('.art'), a = DATA[c.dataset.i];
    if (b.dataset.a === 'more') {
      const open = $('.fl', c).hidden;
      $('.fl', c).hidden = !open; $('.pv', c).hidden = open; b.textContent = open ? 'Ver menos' : 'Leer artículo completo';
    } else {
      navigator.clipboard && navigator.clipboard.writeText(`${DOC[a.doc]}, Art. ${a.num} – ${a.title}\n${a.text}`).then(() => {
        b.textContent = 'Copiado'; setTimeout(() => b.textContent = 'Copiar', 1500);
      });
    }
  });

  $('#chips').innerHTML = QS.map(q => `<button>${q}</button>`).join('');
  $('#chips').onclick = e => { if (e.target.tagName === 'BUTTON') ask(e.target.textContent); };
  $('#f').onsubmit = e => { e.preventDefault(); const i = $('#q'); const v = i.value; i.value = ''; ask(v); };

  /* documentos */
  let dd = 'reg';
  function docs() {
    const f = Covide.norm($('#flt').value.trim());
    const items = DATA.filter(a => a.doc === dd && (!f || Covide.norm(a.title + ' ' + a.text + ' ' + a.num).includes(f)));
    $('#dlist').innerHTML = items.map(a => `<details class="art d"><summary>${plate(a)}<h3>${esc(a.title)}</h3></summary><div class="tx">${paras(a.text)}</div></details>`).join('') || '<p class="lead">No hay artículos con esa palabra.</p>';
  }
  document.querySelectorAll('.dsel button').forEach(b => b.onclick = () => {
    dd = b.dataset.d; document.querySelectorAll('.dsel button').forEach(x => x.setAttribute('aria-pressed', x === b)); docs();
  });
  $('#flt').oninput = docs; docs();
})();
