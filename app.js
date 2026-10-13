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
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; });
  if (matchMedia('(display-mode:standalone)').matches || navigator.standalone) $('#inst').hidden = true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const pAnd = '<p><b>Android:</b> en Chrome tocá ⋮ (arriba a la derecha) y elegí “Instalar app” o “Agregar a pantalla de inicio”.</p>';
  const pIos = '<p><b>iPhone / iPad:</b> abrí el enlace en Safari, tocá Compartir (el cuadrado con la flecha) y elegí “Agregar a inicio”.</p>';
  $('#how').innerHTML = (ios ? pIos + pAnd : pAnd + pIos) + '<p><b>Computadora:</b> en Chrome o Edge, ícono de instalar al final de la barra de direcciones.</p><p>Si abriste el enlace desde WhatsApp, Facebook o Instagram, tocá ⋮ → “Abrir en el navegador” y probá de nuevo: ahí no se puede instalar.</p>';
  $('#inst').onclick = async () => { if (ip) { ip.prompt(); await ip.userChoice; ip = null; } else $('#help').showModal(); };
  $('#hx').onclick = () => $('#help').close();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }

  /* escena: el Cerro de Montevideo, su fortaleza, el faro y la bahía */
  (() => {
    const wave = (y, amp, len, cls, v) => { let d = `M0 ${y}`; for (let x = 0; x < 1600; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`; return `<path class="${cls}" style="fill:var(${v})" d="${d} V260 H0Z"/>`; };
    const p = (r, t) => `${(690 + r * Math.cos(t)).toFixed(1)} ${(78 + r * Math.sin(t)).toFixed(1)}`;
    let rays = '', houses = '';
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; rays += `<path d="M${p(36, a - .1)} L${p(i % 2 ? 50 : 60, a)} L${p(36, a + .1)}Z"/>`; }
    const cols = ['#fff', 'var(--w2)', 'var(--sun)'];
    for (let x = 190, i = 0; x <= 420; x += 26, i++) {
      const e = x < 340 ? 232 - .13 * x : 188 - .244 * (x - 340), y = (e + 9).toFixed(1);
      houses += `<rect x="${x}" y="${y}" width="15" height="10" style="fill:${cols[i % 3]}"/><path d="M${x - 1} ${y} l8.5 -6 l8.5 6z" style="fill:var(--fort)"/>`;
    }
    const crest = [0, 1, 2, 3, 4, 5].map(i => `<rect x="${597 + i * 9}" y="70" width="5" height="4"/>`).join('');
    $('#scene').innerHTML = `<svg viewBox="0 0 800 260" preserveAspectRatio="xMidYMax slice" role="img" aria-label="El Cerro de Montevideo con su fortaleza y el faro, sobre la bahía">
      <g class="sun" style="fill:var(--sun)"><circle cx="690" cy="78" r="30"/>${rays}</g>
      <path style="fill:var(--hill)" d="M0 232 C110 226 230 214 340 188 C430 166 490 122 548 100 C586 86 630 84 664 98 C722 122 770 188 800 204 V260 H0Z"/>
      ${houses}
      <g style="fill:var(--fort)"><rect x="596" y="74" width="54" height="14"/>${crest}<rect x="606" y="62" width="14" height="12"/><path d="M632 74 l3 -22 h8 l3 22z"/><rect x="634" y="46" width="10" height="6"/><path d="M633 46 l6 -9 l6 9z"/></g>
      <circle cx="639" cy="49" r="2.6" style="fill:var(--sun)"/>
      ${wave(220, 5, 200, 'w1', '--w1')}${wave(232, 6, 100, 'w2', '--w2')}${wave(246, 4, 200, 'w3', '--paper')}</svg>`;
  })();

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

  async function ask(q) {
    q = q.trim(); if (!q) return;
    show('chat'); $('#hero').classList.add('gone'); add(esc(q), 'msg u');
    const r = Covide.search(IX, q).res, qs = new Set(Covide.toks(q)), canAI = !!(CFG.AI_ENDPOINT || window.claude);
    if (!r.length) {
      add('No encontré nada claro sobre eso en el Reglamento ni en el Estatuto. Probá con otras palabras (por ejemplo "mascotas", "salón", "cuotas") o consultá al Consejo Directivo.', 'msg plain');
      return;
    }
    const m = add((canAI ? '<div class="ans loading">Redactando respuesta…</div>' : '<p class="lead">Esto dicen los documentos:</p>') + r.map((x, i) => card(x, qs, i)).join(''), 'msg');
    if (!canAI) return;
    const el = $('.ans', m);
    try {
      const ctx = r.map(x => { const a = DATA[x.ai]; return `[${DOC[a.doc]}, Art. ${a.num} – ${a.title}]\n${a.text.slice(0, 3000)}`; }).join('\n\n');
      const t = await ai(q, ctx);
      if (t) { el.classList.remove('loading'); el.innerHTML = fmt(t); el.insertAdjacentHTML('afterend', '<p class="src">Dónde lo dice:</p>'); }
      else { el.className = 'lead'; el.textContent = 'Esto dicen los documentos:'; }
    } catch (e) { el.className = 'lead'; el.textContent = 'No pude redactar la respuesta ahora. Esto dicen los documentos:'; }
    scroller.scrollTop = scroller.scrollHeight;
  }

  $('#home').onclick = () => vt(() => { chat.innerHTML = ''; $('#hero').classList.remove('gone'); show('chat'); scroller.scrollTop = 0; });

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
