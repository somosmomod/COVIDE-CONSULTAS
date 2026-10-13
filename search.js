/* Buscador local: BM25 sobre fragmentos + sinónimos del dominio. Funciona sin internet. */
(function (g) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const STOP = new Set('de la el los las un una unos unas y o u e a en por para con sin que se su sus al del lo le les es son ser mi me mas como cual cuales cuando donde puedo puede pueden hay esta este estos eso hacer tengo tiene tienen si no ni tu nos cada otro otra sobre ante entre hasta desde quiero quien cooperativa cooperativas socio socios'.split(' '));
  const stem = w => (w.length > 5 ? w.slice(0, 5) : w);
  const toks = s => (norm(s).match(/[a-z0-9]+/g) || []).filter(w => (w.length > 2 || /\d/.test(w)) && !STOP.has(w)).map(stem);

  const SYNS = [
    'ruido musica volumen molestia fiesta cumpleanos parlante sonido bulla',
    'perro gato mascota animal',
    'salon festejo evento reunion cumpleanos alquilar',
    'multa castigo sancion penalidad infraccion amonestacion',
    'alquilar alquiler arrendar arrendamiento inquilino ceder prestar',
    'reforma obra obras ampliar ampliacion pared construir modificar autorizacion galpon quincho',
    'expulsar expulsion echar exclusion excluir desalojo',
    'atraso atrasado deuda mora cuota cuotas pagar pago impuntualidad',
    'renuncia renunciar irse retiro retirarse salir',
    'fallecimiento muere murio herencia heredero herederos divorcio separacion matrimonio concubino',
    'asamblea votar voto votacion quorum mayoria',
    'consejo directivo presidente tesorero secretario autoridades comision',
    'basura residuo residuos limpieza limpiar',
    'trabajo horas aporte ayuda mutua',
    'vender venta transferir parte partes capital reembolso',
    'jardin arbol arboles planta parra patio'
  ].map(x => new Set(x.split(' ').map(stem)));

  function build(data) {
    const P = [];
    data.forEach((a, ai) => {
      const parts = a.text.replace(/([.;])\s+/g, '$1\u0001').replace(/\n+/g, '\u0001').split('\u0001').filter(Boolean);
      let cur = '';
      const push = t => {
        const tk = toks(a.title + ' ' + a.title + ' ' + a.title + ' ' + t), tf = new Map();
        tk.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
        P.push({ ai, t, tf, len: tk.length });
      };
      for (const s of parts) {
        if (cur && (cur + ' ' + s).length > 460) { push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s;
      }
      if (cur) push(cur);
    });
    const df = new Map();
    P.forEach(p => p.tf.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));
    return { data, P, df, avg: P.reduce((s, p) => s + p.len, 0) / P.length };
  }

  function search(ix, q) {
    const m = norm(q).match(/\bart(?:iculo|\.)?\s*(\d+)/);
    if (m) {
      const n = +m[1];
      const hit = ix.data.map((a, i) => [a, i]).filter(([a]) => {
        const r = String(a.num).split('–').map(Number);
        return r.length > 1 ? n >= r[0] && n <= r[1] : r[0] === n;
      });
      if (hit.length) return { res: hit.map(([, i]) => ({ ai: i, t: null, s: 99 })) };
    }
    const qt = [...new Set(toks(q))], w = new Map(qt.map(t => [t, 1]));
    SYNS.forEach(S => { if (qt.some(t => S.has(t))) S.forEach(t => { if (!w.has(t)) w.set(t, 0.5); }); });
    const N = ix.P.length, best = new Map();
    for (const p of ix.P) {
      let s = 0;
      for (const [t, wt] of w) {
        const f = p.tf.get(t); if (!f) continue;
        const d = ix.df.get(t);
        s += wt * Math.log(1 + (N - d + 0.5) / (d + 0.5)) * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * p.len / ix.avg));
      }
      if (s > 0 && (!best.has(p.ai) || best.get(p.ai).s < s)) best.set(p.ai, { ai: p.ai, t: p.t, s });
    }
    const res = [...best.values()].sort((a, b) => b.s - a.s), top = res[0] ? res[0].s : 0;
    return { res: top < 1.5 ? [] : res.filter(r => r.s >= top * 0.5).slice(0, 4) };
  }

  g.Covide = { build, search, toks, norm, stem };
  if (typeof module !== 'undefined') module.exports = g.Covide;
})(typeof window !== 'undefined' ? window : globalThis);
