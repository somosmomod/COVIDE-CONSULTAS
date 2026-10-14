(async () => {
  const CFG = window.COVIDE_CONFIG || {};
  const VERSION = '2026.10.14-b';
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

  /* versión y búsqueda de actualizaciones */
  const vb = $('#ver'); vb.textContent = 'Versión ' + VERSION; if (window.COVIDE_DATA) vb.hidden = true;
  vb.onclick = async () => {
    vb.textContent = 'Buscando…';
    try {
      const t = await (await fetch('app.js?' + Date.now(), { cache: 'no-store' })).text(), m = t.match(/VERSION = '([^']+)'/);
      if (m && m[1] !== VERSION) {
        vb.textContent = 'Actualizando…';
        await Promise.all((await caches.keys()).map(k => caches.delete(k)));
        await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r => r.unregister()));
        location.reload(); return;
      }
      vb.textContent = 'Estás en la última versión ✓';
    } catch (e) { vb.textContent = 'Sin conexión'; }
    setTimeout(() => { vb.textContent = 'Versión ' + VERSION; }, 2500);
  };

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
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; });
  if (matchMedia('(display-mode:standalone)').matches || navigator.standalone) $('#inst').hidden = true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const pAnd = '<p><b>Android:</b> en Chrome tocá ⋮ (arriba a la derecha) y elegí “Instalar app” o “Agregar a pantalla de inicio”.</p>';
  const pIos = '<p><b>iPhone / iPad:</b> abrí el enlace en Safari, tocá Compartir (el cuadrado con la flecha) y elegí “Agregar a inicio”.</p>';
  $('#how').innerHTML = (ios ? pIos + pAnd : pAnd + pIos) + '<p><b>Computadora:</b> en Chrome o Edge, ícono de instalar al final de la barra de direcciones.</p><p>Si abriste el enlace desde WhatsApp, Facebook o Instagram, tocá ⋮ → “Abrir en el navegador” y probá de nuevo: ahí no se puede instalar.</p>';
  $('#inst').onclick = async () => { if (ip) { ip.prompt(); await ip.userChoice; ip = null; } else $('#help').showModal(); };
  $('#hx').onclick = () => $('#help').close();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) { try {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) {} }

  /* helpers de render */
  const hl = (t, qs) => esc(t).replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g, w => (qs && qs.has(Covide.stem(Covide.norm(w)))) ? `<mark>${w}</mark>` : w);
  const paras = (t, qs) => t.split('\n').filter(Boolean).map(x => `<p>${hl(x, qs)}</p>`).join('');
  const plate = a => `<div class="plate${String(a.num).length > 3 ? ' w' : ''}"><small>${/^\d/.test(a.num) ? 'Art.' : ''}</small><b>${esc(a.num)}</b><small>${DOC[a.doc]}</small></div>`;
  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  function card(r, qs, i = 0) {
    const a = DATA[r.ai], partial = r.t && r.t !== a.text;
    const pre = r.t ? (a.text.indexOf(r.t) > 0 ? '… ' : '') + r.t + (a.text.trim().endsWith(r.t.trim()) ? '' : ' …') : a.text;
    return `<article class="art new" style="--i:${i}" data-i="${r.ai}">${plate(a)}<div><h3>${esc(a.title)}</h3>
      <div class="tx pv">${paras(pre, qs)}</div><div class="tx fl" hidden>${paras(a.text, qs)}</div>
      <div class="acts">${partial ? '<button data-a="more">Leer artículo completo</button>' : ''}<button data-a="copy">Copiar</button></div></div></article>`;
  }

  /* Worker propio: respuestas con IA y documentos compartidos */
  async function api(path, { method = 'GET', body, admin } = {}) {
    const base = CFG.AI_ENDPOINT.replace(/\/$/, ''), key = admin ? 'acode' : 'code';
    const go = () => fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-code': store.get(key) || (admin ? '' : store.get('acode')) || '' }, body: body && JSON.stringify(body) });
    let r = await go();
    if (r.status === 401) {
      const c = prompt(admin ? 'Código de administración:' : 'Código de socios:');
      if (!c) throw new Error('cancel');
      store.set(key, c); r = await go();
      if (r.status === 401) { store.set(key, ''); throw new Error('Código incorrecto.'); }
    }
    if (!r.ok) throw new Error('Error ' + r.status);
    return r.json();
  }
  async function sampleAI(q, r) {
    if (!window.claude) return null;
    const s = await claude.use('sample'); if (!s) return null;
    const ctx = r.map(x => { const a = DATA[x.ai]; return `[${DOC[a.doc]}, Art. ${a.num} – ${a.title}]\n${a.text.slice(0, 3000)}`; }).join('\n\n');
    return (await s(SYS + '\n\nFragmentos:\n' + ctx + '\n\nPregunta: ' + q, { cache: false, modelTier: 'quick' })).text;
  }

  /* vistas */
  const chat = $('#chat'), scroller = $('#scroll');
  function show(v) {
    $('#vchat').hidden = v !== 'chat'; $('#vdocs').hidden = v !== 'docs'; $('#f').hidden = v !== 'chat'; $('.fine').hidden = v !== 'chat';
    document.querySelectorAll('.main button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
  }
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const vt = fn => { if (document.startViewTransition && !reduce) document.startViewTransition(fn); else fn(); };
  document.querySelectorAll('.main button').forEach(b => b.onclick = e => {
    root.style.setProperty('--vx', e.clientX + 'px'); root.style.setProperty('--vy', e.clientY + 'px');
    vt(() => show(b.dataset.v));
  });

  function add(html, cls) {
    const d = document.createElement('div'); d.className = cls; d.innerHTML = html;
    chat.appendChild(d); scroller.scrollTop = scroller.scrollHeight; return d;
  }

  const inRange = (num, k) => { const r = String(num).split('–').map(Number); return r.length > 1 ? k >= r[0] && k <= r[1] : r[0] === k; };
  function cite(c) {
    const n = Covide.norm(c.doc || ''), dk = n.includes('reglamento') ? 'reg' : n.includes('estatuto') ? 'est' : null;
    const k = parseInt((c.ref || '').replace(/\D+/, ' ').trim()), ai = dk && !isNaN(k) ? DATA.findIndex(a => a.doc === dk && inRange(a.num, k)) : -1;
    const a = ai >= 0 ? DATA[ai] : null;
    const pl = a ? plate(a) : `<div class="plate w"><small>${esc(c.ref || '')}</small><b>${/acta/i.test(c.doc) ? 'Acta' : 'Doc'}</b></div>`;
    return `<article class="art new" ${a ? `data-i="${ai}"` : ''}>${pl}<div><h3>${esc(a ? a.title : c.doc)}</h3>
      <div class="tx pv">${c.quote ? `<blockquote>“${esc(c.quote)}”</blockquote>` : ''}</div>${a ? `<div class="tx fl" hidden>${paras(a.text)}</div>` : ''}
      <div class="acts">${a ? '<button data-a="more">Leer artículo completo</button>' : ''}<button data-a="copy">Copiar</button></div></div></article>`;
  }

  async function ask(q) {
    q = q.trim(); if (!q) return;
    show('chat'); $('#hero').classList.add('gone'); add(esc(q), 'msg u');
    const r = Covide.search(IX, q).res, qs = new Set(Covide.toks(q)), W = !!CFG.AI_ENDPOINT, canAI = W || !!window.claude;
    const local = () => r.map((x, i) => card(x, qs, i)).join('');
    if (!r.length && !W) {
      add('No encontré nada claro sobre eso en el Reglamento ni en el Estatuto. Probá con otras palabras (por ejemplo "mascotas", "salón", "cuotas") o consultá al Consejo Directivo.', 'msg plain');
      return;
    }
    const m = add((canAI ? '<div class="ans loading">Redactando respuesta…</div>' : '<p class="lead">Esto dicen los documentos:</p>') + (W ? '' : local()), 'msg');
    if (!canAI) return;
    const el = $('.ans', m);
    try {
      let t, cs = [];
      if (W) { const j = await api('/ask', { method: 'POST', body: { q } }); t = j.answer; cs = j.citations || []; }
      else t = await sampleAI(q, r);
      if (t) {
        el.classList.remove('loading'); el.innerHTML = fmt(t);
        const body = cs.length ? cs.map(cite).join('') : (W ? local() : '');
        if (body) el.insertAdjacentHTML('afterend', `<p class="src">${cs.length ? 'Citas de los documentos:' : 'Artículos relacionados:'}</p>` + body);
      } else { el.className = 'lead'; el.textContent = 'Esto dicen los documentos:'; }
    } catch (e) {
      el.className = 'lead'; el.textContent = (e.message === 'cancel' ? '' : 'No pude redactar la respuesta ahora. ') + (r.length ? 'Esto dicen los documentos:' : '');
      if (W) el.insertAdjacentHTML('afterend', local());
    }
    scroller.scrollTop = scroller.scrollHeight;
  }

  $('#home').onclick = () => vt(() => { chat.innerHTML = ''; $('#hero').classList.remove('gone'); show('chat'); scroller.scrollTop = 0; });

  chat.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const c = b.closest('.art'), a = c.dataset.i ? DATA[c.dataset.i] : null;
    if (b.dataset.a === 'more') {
      const open = $('.fl', c).hidden;
      $('.fl', c).hidden = !open; $('.pv', c).hidden = open; b.textContent = open ? 'Ver menos' : 'Leer artículo completo';
    } else {
      navigator.clipboard && navigator.clipboard.writeText(a ? `${DOC[a.doc]}, Art. ${a.num} – ${a.title}\n${a.text}` : $('.pv', c).textContent).then(() => {
        b.textContent = 'Copiado'; setTimeout(() => b.textContent = 'Copiar', 1500);
      });
    }
  });

  $('#chips').innerHTML = QS.map(q => `<button>${q}</button>`).join('');
  $('#chips').onclick = e => { if (e.target.tagName === 'BUTTON') ask(e.target.textContent); };
  $('#f').onsubmit = e => { e.preventDefault(); const i = $('#q'); const v = i.value; i.value = ''; ask(v); };

  /* documentos: base (Reglamento, Estatuto) y adicionales (actas, etc.) */
  let dd = 'reg', EXTRA = [];
  async function loadExtra() { if (!CFG.AI_ENDPOINT) return; try { EXTRA = (await api('/docs')).docs || []; } catch (e) { EXTRA = null; } docs(); }
  function docs() {
    const f = Covide.norm($('#flt').value.trim()), L = $('#dlist');
    if (dd === 'x') {
      if (!CFG.AI_ENDPOINT) { L.innerHTML = '<p class="lead">Para sumar actas y otros documentos hay que conectar el Worker (ver README).</p>'; return; }
      const adm = !!store.get('acode');
      const items = (EXTRA || []).filter(d => !f || Covide.norm(d.title + ' ' + d.text).includes(f)).slice().reverse();
      L.innerHTML = '<div class="acts" style="margin:8px 0"><button class="ghost" id="addx">+ Agregar documento</button></div>' + (EXTRA === null ? '<p class="lead">No pude cargar los documentos. Revisá tu conexión.</p>' : items.map(d => `<details class="art d"><summary><div class="plate w"><small>${esc(d.date || '')}</small><b>${/acta/i.test(d.title) ? 'Acta' : 'Doc'}</b></div><h3>${esc(d.title)}</h3></summary><div class="tx">${paras(d.text)}${adm ? `<div class="acts"><button data-del="${d.id}">Eliminar</button></div>` : ''}</div></details>`).join('') || '<p class="lead">Todavía no hay actas ni otros documentos cargados.</p>');
      return;
    }
    const items = DATA.filter(a => a.doc === dd && (!f || Covide.norm(a.title + ' ' + a.text + ' ' + a.num).includes(f)));
    L.innerHTML = items.map(a => `<details class="art d"><summary>${plate(a)}<h3>${esc(a.title)}</h3></summary><div class="tx">${paras(a.text)}</div></details>`).join('') || '<p class="lead">No hay artículos con esa palabra.</p>';
  }
  document.querySelectorAll('.dsel button').forEach(b => b.onclick = () => {
    dd = b.dataset.d; document.querySelectorAll('.dsel button').forEach(x => x.setAttribute('aria-pressed', x === b)); docs();
    if (dd === 'x') loadExtra();
  });
  $('#flt').oninput = docs; docs();

  /* alta de documentos (administración) */
  const st = t => { $('#ast').textContent = t; };
  const b64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
  async function fileData(f) {
    if (f.type === 'application/pdf') return { type: 'pdf', data: await b64(f) };
    const bmp = await createImageBitmap(f), k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = bmp.width * k; c.height = bmp.height * k; c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return { type: 'image', data: c.toDataURL('image/jpeg', .85).split(',')[1] };
  }
  $('#dlist').addEventListener('click', async e => {
    if (e.target.id === 'addx') { $('#adm').showModal(); return; }
    const id = e.target.dataset.del;
    if (id && confirm('¿Eliminar este documento para todos los socios?')) { try { await api('/docs/' + id, { method: 'DELETE', admin: true }); await loadExtra(); } catch (err) { alert(err.message); } }
  });
  $('#ax').onclick = () => $('#adm').close();
  $('#aread').onclick = async () => {
    const fs = [...$('#afile').files]; if (!fs.length) return st('Elegí primero un PDF o fotos de las hojas.');
    st('Leyendo con IA… puede tardar un minuto.');
    try {
      const files = []; for (const f of fs) files.push(await fileData(f));
      $('#atxt').value = (await api('/transcribe', { method: 'POST', body: { files }, admin: true })).text;
      st('Revisá el texto y corregí lo que haga falta antes de publicar.');
    } catch (e) { st(e.message === 'cancel' ? '' : e.message); }
  };
  $('#apub').onclick = async () => {
    const title = $('#atit').value.trim(), text = $('#atxt').value.trim();
    if (!title || !text) return st('Falta el título o el texto.');
    st('Publicando…');
    try {
      await api('/docs', { method: 'POST', body: { title, date: $('#adate').value, text }, admin: true });
      ['atit', 'atxt', 'adate', 'afile'].forEach(i => { $('#' + i).value = ''; }); st(''); $('#adm').close(); await loadExtra();
    } catch (e) { st(e.message === 'cancel' ? '' : e.message); }
  };
})();
