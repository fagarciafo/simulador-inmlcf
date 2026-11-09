/* Simulador de pruebas escritas – Proceso de Selección INMLCF 2026
   Estructura según Anexo Técnico INMLCF-LP-004-SG-2026 (Tablas 5 a 10). */
(function () {
'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const trunc2 = x => Math.floor(x * 100 + 1e-9) / 100;
const fmt = x => trunc2(x).toFixed(2).replace('.', ',');
const LET = ['A', 'B', 'C'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('simInmlcf.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('simInmlcf.' + k, JSON.stringify(v)); return true; } catch (e) { alert('No se pudo guardar en este navegador: ' + e.message); return false; } }
};

const EST = window.ESTRUCTURA;
const BASE = window.BANCO_BASE;
let personal = store.get('personal', []);
const COMP = {}; // id -> {nombre, prueba}
EST.niveles.profesional.componentes.forEach(c => COMP[c.id] = { nombre: c.nombre, prueba: c.prueba });
const IND = {}; // id -> {nombre, comp}
Object.entries(EST.indicadores).forEach(([c, l]) => { if (!c.startsWith('_')) l.forEach(i => IND[i.id] = { nombre: i.nombre, comp: c }); });
const casosMap = Object.fromEntries((BASE.casos || []).map(c => [c.id, c]));

function allItems(incluirPersonal = true) {
  const b = BASE.items.map(i => ({ ...i, origen: 'base' }));
  return incluirPersonal ? b.concat(personal.map(i => ({ ...i, origen: 'personal' }))) : b;
}

/* ---------- pestañas ---------- */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  $$('#tabs button').forEach(x => x.classList.toggle('active', x === b));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'banco') renderBanco();
  if (b.dataset.tab === 'historial') renderHist();
});

/* ---------- configuración ---------- */
const cfgComp = $('#cfg-comp');
Object.entries(COMP).forEach(([id, c]) => cfgComp.insertAdjacentHTML('beforeend', `<option value="${id}">${esc(c.nombre)} (${c.prueba})</option>`));

function leerCfg() {
  return {
    nivel: $('#cfg-nivel').value, grupo: $('#cfg-grupo').value, modo: $('#cfg-modo').value, comp: cfgComp.value,
    feedback: $('#cfg-feedback').value, tiempo: +$('#cfg-tiempo').value || 0, barajar: $('#cfg-barajar').checked,
    personal: $('#cfg-personal').checked, bloques: $('#cfg-bloques').checked, va: +$('#cfg-va').value || 0
  };
}
function componentesDe(cfg) {
  let comps = EST.niveles[cfg.nivel].componentes;
  if (cfg.modo === 'funcionales') comps = comps.filter(c => c.prueba === 'funcionales');
  if (cfg.modo === 'comportamentales') comps = comps.filter(c => c.prueba === 'comportamentales');
  if (cfg.modo === 'componente') comps = comps.filter(c => c.id === cfg.comp);
  return comps;
}
function previewEstructura() {
  const cfg = leerCfg();
  $('#lbl-comp').classList.toggle('hidden', cfg.modo !== 'componente');
  $('#lbl-va').classList.toggle('hidden', cfg.grupo !== 'grupos_3_4');
  const pool = allItems(cfg.personal).filter(i => !i.caso);
  let html = '', total = 0;
  if (cfg.modo === 'casos') {
    const n = BASE.items.filter(i => i.caso).length;
    html = `<p class="muted">${(BASE.casos || []).length} casos con ${n} preguntas. Cada caso presenta un contexto común y varias preguntas de 3 opciones, como en los simulacros de Misión Mérito.</p>`;
    total = n;
  } else if (cfg.modo === 'rapido') {
    html = `<p class="muted">20 ítems al azar de todo el banco.</p>`; total = 20;
  } else {
    html = '<table><tr><th>Prueba</th><th>Componente</th><th class="num">Indicadores</th><th class="num">Ítems (Anexo)</th><th class="num">Disponibles</th></tr>';
    componentesDe(cfg).forEach(c => {
      const disp = pool.filter(i => i.comp === c.id).length; total += c.items;
      html += `<tr><td>${c.prueba === 'funcionales' ? 'Competencias funcionales' : 'Comportamentales e integridad'}</td><td>${esc(c.nombre)}</td><td class="num">${c.indicadores}</td><td class="num">${c.items}</td><td class="num">${disp >= c.items ? `<span class="pill ok">${disp}</span>` : `<span class="pill warn">${disp}</span>`}</td></tr>`;
    });
    html += `<tr><th colspan="3">Total</th><th class="num">${total}</th><th></th></tr></table>`;
  }
  $('#estructura-preview').innerHTML = html;
  $('#tiempo-sug').textContent = `Sugerido: ${Math.round(total * 1.5)} min (≈1,5 min por ítem). El Anexo deja el tiempo a la Guía de Orientación.`;
}
['#cfg-nivel', '#cfg-grupo', '#cfg-modo', '#cfg-comp', '#cfg-personal'].forEach(s => $(s).addEventListener('change', previewEstructura));

/* ---------- armado del examen ---------- */
function armar(cfg) {
  const pool = shuffle(allItems(cfg.personal));
  const avisos = []; let sel = [];
  if (cfg.modo === 'casos') {
    shuffle(BASE.casos || []).forEach(k => sel.push(...BASE.items.filter(i => i.caso === k.id).map(i => ({ ...i, origen: 'base' }))));
  } else if (cfg.modo === 'rapido') {
    sel = pool.filter(i => !i.caso).slice(0, 20);
  } else {
    const usados = new Set();
    componentesDe(cfg).forEach(c => {
      const inds = (EST.indicadores[c.id] || []).slice(0, c.indicadores);
      const porInd = Math.floor(c.items / Math.max(inds.length, 1));
      let bloque = [];
      inds.forEach(ind => {
        const cand = pool.filter(i => !i.caso && i.ind === ind.id && !usados.has(i.id)).slice(0, porInd);
        cand.forEach(i => usados.add(i.id)); bloque.push(...cand);
        if (cand.length < porInd) avisos.push(`${ind.nombre}: ${cand.length} de ${porInd}`);
      });
      if (bloque.length < c.items) {
        const extra = pool.filter(i => !i.caso && i.comp === c.id && !usados.has(i.id)).slice(0, c.items - bloque.length);
        extra.forEach(i => usados.add(i.id)); bloque.push(...extra);
      }
      if (bloque.length < c.items) avisos.push(`${c.nombre}: solo hay ${bloque.length} de ${c.items} ítems`);
      sel.push(...shuffle(bloque));
    });
    if (!cfg.bloques) sel = shuffle(sel);
  }
  const preguntas = sel.map(item => ({ item, orden: cfg.barajar ? shuffle([0, 1, 2]) : [0, 1, 2], resp: null, marcada: false }));
  return { cfg, preguntas, avisos, inicio: Date.now(), idx: 0 };
}

let EX = null, timerId = null;
$('#btn-iniciar').addEventListener('click', () => {
  const cfg = leerCfg();
  EX = armar(cfg);
  if (!EX.preguntas.length) { alert('No hay ítems disponibles para esa configuración.'); return; }
  if (EX.avisos.length && !confirm('El banco no alcanza para la estructura completa:\n\n' + EX.avisos.join('\n') + '\n\nPuedes cargar documentos para generar más ítems. ¿Iniciar de todas formas?')) return;
  $('#config').classList.add('hidden'); $('#resultados').classList.add('hidden'); $('#examen').classList.remove('hidden');
  const t = { completa: 'Prueba completa', funcionales: 'Competencias funcionales', comportamentales: 'Competencias comportamentales e integridad', componente: COMP[cfg.comp].nombre, casos: 'Casos estilo Misión Mérito', rapido: 'Práctica rápida' }[cfg.modo];
  $('#ex-titulo').textContent = `${t} · nivel ${cfg.nivel}`;
  renderHoja(); renderPregunta();
  clearInterval(timerId);
  timerId = setInterval(tick, 1000); tick();
  window.scrollTo(0, 0);
});
function tick() {
  if (!EX) return;
  const seg = Math.floor((Date.now() - EX.inicio) / 1000);
  if (EX.cfg.tiempo) {
    const rest = EX.cfg.tiempo * 60 - seg;
    if (rest <= 0) { clearInterval(timerId); alert('Se agotó el tiempo.'); finalizar(); return; }
    $('#ex-timer').textContent = '⏱ ' + hms(rest);
  } else $('#ex-timer').textContent = '⏱ ' + hms(seg);
}
const hms = s => [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');

function renderHoja() {
  let html = '', prev = null;
  EX.preguntas.forEach((p, i) => {
    const caso = p.item.caso && casosMap[p.item.caso];
    const grupo = caso ? caso.id : COMP[p.item.comp].prueba;
    if ((caso || EX.cfg.bloques) && grupo !== prev) { html += `<div class="sep">${caso ? esc(caso.titulo.split(' – ')[0]) : grupo === 'funcionales' ? 'Funcionales' : 'Comportamentales e integridad'}</div>`; prev = grupo; }
    let cls = [];
    if (p.resp !== null) cls.push('r');
    if (p.marcada) cls.push('m');
    if (i === EX.idx) cls.push('c');
    if (EX.cfg.feedback === 'inmediata' && p.resp !== null) cls.push(p.orden[p.resp] === p.item.clave ? 'ok' : 'bad');
    html += `<button data-i="${i}" class="${cls.join(' ')}">${i + 1}${p.resp !== null ? LET[p.resp] : ''}</button>`;
  });
  $('#hoja-grid').innerHTML = html;
  const resp = EX.preguntas.filter(p => p.resp !== null).length;
  $('#ex-progreso').textContent = `${resp} de ${EX.preguntas.length} respondidas`;
}
$('#hoja-grid').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) { EX.idx = +b.dataset.i; renderHoja(); renderPregunta(); } });

function renderPregunta() {
  const p = EX.preguntas[EX.idx], it = p.item;
  const mostrar = EX.cfg.feedback === 'inmediata' && p.resp !== null;
  const caso = it.caso && casosMap[it.caso];
  let html = `<div class="qmeta"><span class="pill">Ítem ${EX.idx + 1} de ${EX.preguntas.length}</span><span class="pill">${esc(COMP[it.comp].nombre)}</span>${mostrar ? `<span class="pill">${esc(IND[it.ind]?.nombre || it.ind)}</span>` : ''}${it.origen === 'personal' ? '<span class="pill warn">Banco personal</span>' : ''}</div>`;
  if (caso) html += `<div class="contexto"><strong>${esc(caso.titulo)}</strong><br>${esc(caso.contexto)}</div>`;
  html += `<p class="enunciado">${esc(it.enunciado)}</p><div class="opciones">`;
  p.orden.forEach((orig, pos) => {
    let cls = 'opt';
    if (p.resp === pos) cls += ' sel';
    if (mostrar) { if (orig === it.clave) cls += ' correcta'; else if (p.resp === pos) cls += ' incorrecta'; }
    html += `<button class="${cls}" data-pos="${pos}" ${mostrar ? 'disabled' : ''}><span class="letra">${LET[pos]}.</span><span>${esc(it.opciones[orig])}</span></button>`;
  });
  html += '</div>';
  if (mostrar) html += `<div class="just"><strong>${p.orden[p.resp] === it.clave ? '✔ Correcta' : '✘ Incorrecta'} · Clave: ${LET[p.orden.indexOf(it.clave)]}</strong><br>${esc(it.just)}<div class="muted">Eje temático: ${esc(it.eje)}</div></div>`;
  html += `<div class="qnav"><button id="q-prev" ${EX.idx === 0 ? 'disabled' : ''}>← Anterior</button><button id="q-mark" class="ghost">${p.marcada ? 'Quitar marca' : 'Marcar para revisar'}</button><button id="q-next" class="primary">${EX.idx === EX.preguntas.length - 1 ? 'Ir a finalizar' : 'Siguiente →'}</button></div>`;
  $('#qcard').innerHTML = html;
}
$('#qcard').addEventListener('click', e => {
  const p = EX.preguntas[EX.idx];
  const opt = e.target.closest('.opt');
  if (opt && !opt.disabled) { p.resp = +opt.dataset.pos; renderHoja(); renderPregunta(); return; }
  if (e.target.id === 'q-prev') { EX.idx--; }
  else if (e.target.id === 'q-next') { if (EX.idx === EX.preguntas.length - 1) return finalizarConfirm(); EX.idx++; }
  else if (e.target.id === 'q-mark') { p.marcada = !p.marcada; }
  else return;
  renderHoja(); renderPregunta();
});
document.addEventListener('keydown', e => {
  if (!EX || $('#examen').classList.contains('hidden') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const k = e.key.toUpperCase();
  if (['A', 'B', 'C'].includes(k)) { const b = $(`#qcard .opt[data-pos="${LET.indexOf(k)}"]`); if (b && !b.disabled) b.click(); }
  if (e.key === 'ArrowRight' && EX.idx < EX.preguntas.length - 1) { EX.idx++; renderHoja(); renderPregunta(); }
  if (e.key === 'ArrowLeft' && EX.idx > 0) { EX.idx--; renderHoja(); renderPregunta(); }
});
$('#btn-finalizar').addEventListener('click', finalizarConfirm);
function finalizarConfirm() {
  const sin = EX.preguntas.filter(p => p.resp === null).length;
  if (sin && !confirm(`Tienes ${sin} ítems sin responder. ¿Finalizar y calificar?`)) return;
  finalizar();
}

/* ---------- calificación ---------- */
function finalizar() {
  clearInterval(timerId);
  const cfg = EX.cfg, P = EX.preguntas;
  const acierto = p => p.resp !== null && p.orden[p.resp] === p.item.clave;
  const agg = (fn) => { const g = {}; P.forEach(p => { const k = fn(p); g[k] = g[k] || { n: 0, ok: 0 }; g[k].n++; if (acierto(p)) g[k].ok++; }); return g; };
  const porPrueba = agg(p => COMP[p.item.comp].prueba), porComp = agg(p => p.item.comp), porInd = agg(p => p.item.ind);
  const pct = g => g ? trunc2(100 * g.ok / g.n) : null;
  const F = pct(porPrueba.funcionales), C = pct(porPrueba.comportamentales);
  const reglas = EST.calificacion[cfg.grupo];
  let pond = null, estado = '';
  if (F !== null && C !== null) {
    if (cfg.grupo === 'grupos_1_2') pond = trunc2(F * .65 + C * .35);
    else pond = trunc2(F * .50 + C * .30 + cfg.va * .20);
  }
  if (F !== null) estado = F >= reglas.funcionales.minimo ? '<span class="pill ok">Supera el mínimo eliminatorio (65,00)</span>' : '<span class="pill bad">No supera el mínimo eliminatorio (65,00): quedaría fuera del proceso</span>';
  const dur = Math.floor((Date.now() - EX.inicio) / 1000);
  const totalOk = P.filter(acierto).length;

  let html = `<div class="card"><h2>Resultados</h2><div class="kpis">`;
  if (F !== null) html += `<div class="kpi"><div class="l">Competencias funcionales (eliminatoria)</div><div class="v">${fmt(F)}</div>${estado}</div>`;
  if (C !== null) html += `<div class="kpi"><div class="l">Comportamentales e integridad (clasificatoria)</div><div class="v">${fmt(C)}</div></div>`;
  if (pond !== null) html += `<div class="kpi"><div class="l">Puntaje ponderado (${cfg.grupo === 'grupos_1_2' ? '65/35' : '50/30/20'})</div><div class="v">${fmt(pond)}</div>${F < 65 ? '<span class="pill bad">No aplica: eliminado en funcionales</span>' : ''}</div>`;
  html += `<div class="kpi"><div class="l">Aciertos totales</div><div class="v">${totalOk}/${P.length}</div><div class="muted">Tiempo: ${hms(dur)}</div></div></div>`;
  html += `<p class="muted">Escala 0,00 a 100,00 con dos decimales truncados. Aquí se usa el porcentaje de aciertos; en la prueba real el operador aplica una transformación lineal sobre el análisis psicométrico de los ítems.</p>`;
  html += '<h3>Por componente</h3><table><tr><th>Componente</th><th class="num">Aciertos</th><th class="num">Puntaje</th><th></th></tr>';
  Object.entries(porComp).forEach(([k, g]) => html += `<tr><td>${esc(COMP[k].nombre)}</td><td class="num">${g.ok}/${g.n}</td><td class="num">${fmt(100 * g.ok / g.n)}</td><td><div class="bar"><span style="width:${100 * g.ok / g.n}%"></span></div></td></tr>`);
  html += '</table><h3>Por indicador</h3><table><tr><th>Indicador</th><th class="num">Aciertos</th><th class="num">%</th></tr>';
  Object.entries(porInd).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).forEach(([k, g]) => html += `<tr><td>${esc(IND[k]?.nombre || k)}</td><td class="num">${g.ok}/${g.n}</td><td class="num">${Math.round(100 * g.ok / g.n)}</td></tr>`);
  html += `</table><div class="actions"><button class="primary" id="btn-otro">Nuevo simulacro</button><button id="btn-repaso">Repasar solo los errores</button></div></div>`;
  html += `<div class="card"><h2>Revisión con justificación de clave y distractores</h2><label class="chk"><input type="checkbox" id="rev-err"> Ver solo incorrectas o sin responder</label><div id="revision"></div></div>`;
  $('#resultados').innerHTML = html;
  $('#examen').classList.add('hidden'); $('#resultados').classList.remove('hidden');
  const renderRev = () => {
    const solo = $('#rev-err').checked;
    $('#revision').innerHTML = P.map((p, i) => {
      if (solo && acierto(p)) return '';
      const it = p.item, caso = it.caso && casosMap[it.caso];
      return `<div class="review-item"><div class="qmeta"><span class="pill ${acierto(p) ? 'ok' : 'bad'}">${i + 1}. ${acierto(p) ? 'Correcta' : p.resp === null ? 'Sin responder' : 'Incorrecta'}</span><span class="pill">${esc(COMP[it.comp].nombre)}</span><span class="pill">${esc(IND[it.ind]?.nombre || it.ind)}</span></div>
        ${caso ? `<div class="contexto">${esc(caso.contexto)}</div>` : ''}<p>${esc(it.enunciado)}</p><div class="opciones">${p.orden.map((o, pos) => `<div class="opt ${o === it.clave ? 'correcta' : (p.resp === pos ? 'incorrecta' : '')}"><span class="letra">${LET[pos]}.</span><span>${esc(it.opciones[o])}</span></div>`).join('')}</div>
        <div class="just">${esc(it.just)}<div class="muted">Eje temático: ${esc(it.eje)}${it.fuente ? ' · Fuente: ' + esc(it.fuente) : ''}</div></div></div>`;
    }).join('');
  };
  $('#rev-err').addEventListener('change', renderRev); renderRev();
  $('#btn-otro').addEventListener('click', () => { $('#resultados').classList.add('hidden'); $('#config').classList.remove('hidden'); EX = null; });
  $('#btn-repaso').addEventListener('click', () => {
    const errs = P.filter(p => !acierto(p)).map(p => ({ item: p.item, orden: cfg.barajar ? shuffle([0, 1, 2]) : [0, 1, 2], resp: null, marcada: false }));
    if (!errs.length) { alert('¡No tienes errores para repasar!'); return; }
    EX = { cfg: { ...cfg, feedback: 'inmediata', tiempo: 0, bloques: false }, preguntas: errs, avisos: [], inicio: Date.now(), idx: 0 };
    $('#resultados').classList.add('hidden'); $('#examen').classList.remove('hidden');
    $('#ex-titulo').textContent = 'Repaso de errores'; renderHoja(); renderPregunta(); timerId = setInterval(tick, 1000);
  });
  const hist = store.get('historial', []);
  hist.unshift({ fecha: new Date().toISOString(), modo: cfg.modo, nivel: cfg.nivel, grupo: cfg.grupo, F, C, pond, n: P.length, ok: totalOk, dur, porComp: Object.fromEntries(Object.entries(porComp).map(([k, g]) => [k, trunc2(100 * g.ok / g.n)])) });
  store.set('historial', hist.slice(0, 200));
  window.scrollTo(0, 0);
}

/* ---------- historial ---------- */
function renderHist() {
  const h = store.get('historial', []);
  if (!h.length) { $('#hist').innerHTML = '<p class="muted">Aún no has presentado simulacros.</p>'; return; }
  $('#hist').innerHTML = '<table><tr><th>Fecha</th><th>Tipo</th><th>Nivel</th><th class="num">Funcionales</th><th class="num">Comport.</th><th class="num">Ponderado</th><th class="num">Aciertos</th><th class="num">Tiempo</th></tr>' +
    h.map(r => `<tr><td>${new Date(r.fecha).toLocaleString('es-CO')}</td><td>${r.modo}</td><td>${r.nivel}</td><td class="num">${r.F == null ? '—' : fmt(r.F)}</td><td class="num">${r.C == null ? '—' : fmt(r.C)}</td><td class="num">${r.pond == null ? '—' : fmt(r.pond)}</td><td class="num">${r.ok}/${r.n}</td><td class="num">${hms(r.dur)}</td></tr>`).join('') + '</table>';
}
$('#btn-borrar-hist').addEventListener('click', () => { if (confirm('¿Borrar todo el historial?')) { store.set('historial', []); renderHist(); } });

/* ---------- banco ---------- */
const fComp = $('#f-comp');
Object.entries(COMP).forEach(([id, c]) => fComp.insertAdjacentHTML('beforeend', `<option value="${id}">${esc(c.nombre)}</option>`));
function renderBanco() {
  const todos = allItems(true).filter(i => !i.caso);
  const req = Object.fromEntries(EST.niveles.profesional.componentes.map(c => [c.id, c]));
  let html = '<table><tr><th>Componente / indicador</th><th class="num">Requeridos (profesional)</th><th class="num">Banco base</th><th class="num">Personal</th></tr>';
  Object.entries(COMP).forEach(([cid, c]) => {
    const r = req[cid], porInd = Math.floor(r.items / r.indicadores);
    html += `<tr><th>${esc(c.nombre)}</th><th class="num">${r.items}</th><th class="num">${todos.filter(i => i.comp === cid && i.origen === 'base').length}</th><th class="num">${todos.filter(i => i.comp === cid && i.origen === 'personal').length}</th></tr>`;
    EST.indicadores[cid].forEach(ind => html += `<tr><td>&nbsp;&nbsp;${esc(ind.nombre)}</td><td class="num">${porInd}</td><td class="num">${todos.filter(i => i.ind === ind.id && i.origen === 'base').length}</td><td class="num">${todos.filter(i => i.ind === ind.id && i.origen === 'personal').length}</td></tr>`);
  });
  $('#cobertura').innerHTML = html + '</table>';
  renderLista();
}
function renderLista() {
  const c = fComp.value, o = $('#f-origen').value, t = $('#f-texto').value.toLowerCase();
  const items = allItems(true).filter(i => (!c || i.comp === c) && (!o || i.origen === o) && (!t || (i.enunciado + ' ' + i.eje).toLowerCase().includes(t)));
  $('#lista-items').innerHTML = `<p class="muted">${items.length} ítems</p>` + items.slice(0, 300).map(i => `<div class="item-row"><details><summary><span class="pill">${esc(i.id)}</span> <span class="pill">${esc(IND[i.ind]?.nombre || i.ind)}</span> ${i.origen === 'personal' ? '<span class="pill warn">personal</span>' : ''} ${esc(i.enunciado.slice(0, 140))}…</summary>
    <p>${esc(i.enunciado)}</p><ol type="A">${i.opciones.map((op, k) => `<li${k === i.clave ? ' style="font-weight:600;color:var(--ok)"' : ''}>${esc(op)}</li>`).join('')}</ol><div class="just">${esc(i.just)}<div class="muted">Eje: ${esc(i.eje)} · Fuente: ${esc(i.fuente || '')}</div></div>
    ${i.origen === 'personal' ? `<div class="actions"><button class="ghost danger" data-del="${esc(i.id)}">Eliminar</button></div>` : ''}</details></div>`).join('');
}
['#f-comp', '#f-origen'].forEach(s => $(s).addEventListener('change', renderLista));
$('#f-texto').addEventListener('input', renderLista);
$('#lista-items').addEventListener('click', e => { const id = e.target.dataset.del; if (id && confirm('¿Eliminar este ítem de tu banco personal?')) { personal = personal.filter(i => i.id !== id); store.set('personal', personal); renderBanco(); } });
$('#btn-exportar').addEventListener('click', () => descargar(`banco_personal_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: '1.0', items: personal }, null, 1)));
$('#in-importar').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text()); const arr = Array.isArray(d) ? d : d.items || [];
    const ok = arr.map(normalizarItem).filter(Boolean);
    const ids = new Set(personal.map(i => i.id)); let n = 0;
    ok.forEach(i => { if (!ids.has(i.id)) { personal.push(i); n++; } });
    store.set('personal', personal); alert(`Importados ${n} ítems (${arr.length - ok.length} descartados por formato).`); renderBanco();
  } catch (err) { alert('Archivo inválido: ' + err.message); }
  e.target.value = '';
});
$('#btn-borrar-personal').addEventListener('click', () => { if (confirm('¿Borrar todo tu banco personal? Exporta antes si quieres conservarlo.')) { personal = []; store.set('personal', personal); renderBanco(); } });
$('#btn-nuevo-item').addEventListener('click', () => {
  const card = $('#form-item-card'); card.classList.remove('hidden');
  card.innerHTML = `<h2>Nueva pregunta (formato del Anexo)</h2><div class="grid2"><label>Indicador<select id="ni-ind">${Object.entries(IND).map(([id, x]) => `<option value="${id}">${esc(COMP[x.comp].nombre)} · ${esc(x.nombre)}</option>`).join('')}</select></label><label>Eje temático<input id="ni-eje"></label></div>
  <label>Enunciado (situación + incidente crítico + pregunta)<textarea id="ni-enun"></textarea></label>${[0, 1, 2].map(k => `<label>Opción ${LET[k]}<input id="ni-o${k}"></label>`).join('')}
  <div class="grid2"><label>Clave<select id="ni-clave"><option value="0">A</option><option value="1">B</option><option value="2">C</option></select></label></div><label>Justificación de clave y distractores<textarea id="ni-just"></textarea></label>
  <div class="actions"><button class="primary" id="ni-guardar">Guardar</button><button class="ghost" id="ni-cancelar">Cancelar</button></div>`;
  $('#ni-cancelar').onclick = () => card.classList.add('hidden');
  $('#ni-guardar').onclick = () => {
    const ind = $('#ni-ind').value;
    const it = normalizarItem({ ind, comp: IND[ind].comp, eje: $('#ni-eje').value || IND[ind].nombre, enunciado: $('#ni-enun').value, opciones: [0, 1, 2].map(k => $('#ni-o' + k).value), clave: +$('#ni-clave').value, just: $('#ni-just').value, fuente: 'Manual' });
    if (!it) { alert('Completa el enunciado y las tres opciones.'); return; }
    personal.push(it); store.set('personal', personal); card.classList.add('hidden'); renderBanco();
  };
});
function normalizarItem(i) {
  if (!i || !i.enunciado || !Array.isArray(i.opciones) || i.opciones.length !== 3 || i.opciones.some(o => !String(o).trim())) return null;
  let clave = i.clave; if (typeof clave === 'string') clave = LET.indexOf(clave.trim().toUpperCase().charAt(0));
  if (![0, 1, 2].includes(clave)) return null;
  let ind = IND[i.ind] ? i.ind : null, comp = i.comp;
  if (!ind && COMP[comp]) ind = EST.indicadores[comp][0].id;
  if (!ind) return null;
  return { id: i.id || ('P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), comp: IND[ind].comp, ind, eje: i.eje || IND[ind].nombre, enunciado: String(i.enunciado).trim(), opciones: i.opciones.map(o => String(o).trim()), clave, just: i.just || '', fuente: i.fuente || 'Importado', borrador: !!i.borrador };
}
function descargar(nombre, texto) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- documentos: extracción ---------- */
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
let DOCS = []; // {nombre, texto, frags:[]}
const drop = $('#drop');
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => procesarArchivos(e.dataTransfer.files));
$('#in-docs').addEventListener('change', e => { procesarArchivos(e.target.files); e.target.value = ''; });

async function extraerTexto(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    if (!window.pdfjsLib) throw new Error('No cargó el lector de PDF (requiere conexión).');
    const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise; let out = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const c = await (await pdf.getPage(p)).getTextContent(); let lastY = null, line = '';
      c.items.forEach(it => { const y = it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 2) { out += line + '\n'; line = ''; } line += it.str; lastY = y; });
      out += line + '\n\n';
    }
    return out;
  }
  if (ext === 'docx') { if (!window.mammoth) throw new Error('No cargó el lector de Word (requiere conexión).'); return (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value; }
  return await f.text();
}
async function procesarArchivos(files) {
  for (const f of files) {
    $('#docs-lista').insertAdjacentHTML('beforeend', `<p class="muted" id="st-${DOCS.length}">Procesando ${esc(f.name)}…</p>`);
    const st = $(`#st-${DOCS.length}`);
    try {
      const texto = await extraerTexto(f);
      const frags = fragmentar(texto).map((t, k) => caracterizar(t, f.name, k));
      frags.slice().sort((a, b) => b.conf - a.conf).slice(0, 25).forEach(fr => { if (fr.conf >= 4) fr.sel = true; });
      DOCS.push({ nombre: f.name, texto, frags });
      st.innerHTML = `✔ <strong>${esc(f.name)}</strong>: ${texto.length.toLocaleString('es-CO')} caracteres, ${frags.length} fragmentos.`;
    } catch (err) { st.textContent = `✘ ${f.name}: ${err.message}`; DOCS.push({ nombre: f.name, texto: '', frags: [] }); }
  }
  renderCarac();
}
function fragmentar(texto) {
  const limpio = texto.replace(/\r/g, '').replace(/-\n(?=[a-záéíóúñ])/g, '').replace(/[ \t]+/g, ' ');
  const parrafos = limpio.split(/\n\s*\n|\n(?=\s*(?:ART[IÍ]CULO|Art[íi]culo|\d+\.\d*\s|[a-z]\)\s|•|●|-\s))/).map(s => s.replace(/\n/g, ' ').trim()).filter(s => s.length > 40);
  const frags = []; let buf = '';
  parrafos.forEach(p => {
    if ((buf + ' ' + p).length > 900 && buf.length > 250) { frags.push(buf.trim()); buf = ''; }
    buf += ' ' + p;
    while (buf.length > 1400) { const corte = buf.lastIndexOf('. ', 1000); const k = corte > 300 ? corte + 1 : 1000; frags.push(buf.slice(0, k).trim()); buf = buf.slice(k); }
  });
  if (buf.trim().length > 80) frags.push(buf.trim());
  return frags;
}

/* ---------- caracterización ---------- */
const KW = {
  CG1: ['constitución', 'función pública', 'función administrativa', 'artículo 209', 'tutela', 'derechos fundamentales', 'estado social', 'carrera administrativa', 'rama', 'procuraduría', 'contraloría', 'principio'],
  CG2: ['medicina legal', 'instituto nacional', 'ley 938', 'decreto ley 020', 'carrera especial', 'fiscalía general', 'comisión de la carrera', 'opece', 'sistema de medicina legal', 'perito', 'pericial'],
  CG3: ['derecho de petición', 'ley 1755', 'disciplinario', 'ley 1952', 'conflicto de interés', 'impedimento', 'transparencia', 'ley 1712', 'código de integridad', 'ética', 'pqrs', 'ciudadano'],
  CE1: ['iso 9001', 'calidad', 'no conformidad', 'acción correctiva', 'información documentada', 'revisión por la dirección', 'partes interesadas', 'phva', 'satisfacción', 'proceso'],
  CE2: ['17025', 'laboratorio', 'ensayo', 'imparcialidad', 'validación', 'método', 'trabajo no conforme', 'ensayo de aptitud', 'interlaboratorio', 'informe de resultados', 'acreditación'],
  CE3: ['17020', 'inspección', 'metrolog', 'calibración', 'incertidumbre', 'trazabilidad', 'patrón', 'error máximo', 'verificación', 'alcohol', 'balanza', 'instrumento'],
  CE4: ['mipg', 'modelo integrado', 'decreto 1499', 'furag', 'control interno', 'meci', 'línea de defensa', 'dimensión', 'gestión y desempeño', 'planeación'],
  CE5: ['riesgo', 'control', 'corrupción', 'probabilidad', 'impacto', 'materialización', 'mapa de riesgos', 'seguridad de la información', 'confidencialidad', 'residual', 'inherente'],
  CE6: ['cadena de custodia', 'elemento material probatorio', 'evidencia física', 'embalaje', 'rotulado', 'ley 906', 'registro de continuidad', 'necropsia', 'muestra', 'almacén de evidencias'],
  CE7: ['archivo', 'documental', 'trd', 'retención', 'ley 594', 'expediente', 'transferencia', 'fuid', 'eliminación', 'serie', 'agn'],
  CE8: ['auditoría', 'auditor', 'hallazgo', 'iso 19011', 'indicador', 'eficacia', 'eficiencia', 'mejora', 'programa de auditoría', 'evidencia objetiva'],
  HA1: ['análisis', 'problema', 'priorizar', 'datos', 'decisión', 'alternativa'],
  HA2: ['texto', 'lectura', 'interpretación', 'concepto'],
  AP1: ['lógico', 'premisa', 'conclusión', 'silogismo'],
  AP2: ['porcentaje', 'promedio', 'proporción', 'tasa', 'estadística'],
  CC1: ['aprendizaje', 'capacitación', 'actualización', 'conocimiento'],
  CC2: ['resultados', 'metas', 'objetivos', 'oportunidad'],
  CC3: ['usuario', 'ciudadano', 'atención', 'servicio'],
  CC4: ['compromiso con la organización', 'misión', 'visión', 'institucional'],
  CC5: ['trabajo en equipo', 'colaboración', 'equipo'],
  CT1: ['adaptación al cambio', 'cambio', 'flexibilidad'],
  CN1: ['aporte técnico', 'conceptos técnicos', 'experticia', 'profesional'],
  VI1: ['honestidad', 'transparencia', 'veracidad'], VI2: ['respeto', 'dignidad', 'trato'], VI3: ['compromiso'], VI4: ['diligencia', 'oportuno', 'cuidado'], VI5: ['justicia', 'imparcialidad', 'equidad']
};
const RE_NORMA = /\b(?:Ley|Decreto(?:\s+Ley)?|Decreto-Ley|Resoluci[oó]n|Acuerdo|Circular(?:\s+Externa)?|Directiva|Sentencia)\s+(?:No\.?\s*|N[°º]\s*)?[A-Z]?-?\d[\d.\-]*\s+de\s+\d{4}|\bNTC[-\s]?ISO(?:\/IEC)?\s*\d+|\bISO(?:\/IEC)?\s*\d{4,5}/gi;
function caracterizar(t, doc, k) {
  const low = t.toLowerCase(); const scores = {};
  Object.entries(KW).forEach(([ind, ws]) => { let s = 0; ws.forEach(w => { const m = low.split(w).length - 1; s += m * (w.length > 8 ? 2 : 1); }); if (s) scores[ind] = s; });
  const ranking = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const ind = ranking[0] ? ranking[0][0] : 'CE1';
  const normas = [...new Set((t.match(RE_NORMA) || []).map(s => s.replace(/\s+/g, ' ')))];
  const tipo = /\b(deber[áa]n?|obligaci[oó]n|prohib|no podr[áa]|t[ée]rmino|plazo|sanci[oó]n)\b/i.test(t) ? 'Normativo/obligación' : /\b(se entiende por|definici[oó]n|consiste en|es el|es la)\b/i.test(t) ? 'Definición' : /\b(paso|procedimiento|actividad|responsable|registr)/i.test(t) ? 'Procedimiento' : 'Descriptivo';
  return { id: `${doc}#${k}`, doc, texto: t, ind, conf: ranking[0] ? ranking[0][1] : 0, alt: ranking.slice(1, 3).map(r => r[0]), normas, tipo, sel: false };
}
function fragsTodos() { return DOCS.flatMap(d => d.frags); }
function renderCarac() {
  const F = fragsTodos(); if (!F.length) return;
  $('#carac-card').classList.remove('hidden'); $('#gen-card').classList.remove('hidden');
  const cont = {}; F.forEach(f => cont[f.ind] = (cont[f.ind] || 0) + 1);
  const normas = {}; F.forEach(f => f.normas.forEach(n => normas[n] = (normas[n] || 0) + 1));
  $('#carac-resumen').innerHTML = `<p><strong>${F.length}</strong> fragmentos en ${DOCS.length} documento(s). Seleccionados para generar: <strong>${F.filter(f => f.sel).length}</strong>.</p>
   <div class="grid2"><div><h3>Indicadores sugeridos</h3><table>${Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([i, n]) => `<tr><td>${esc(COMP[IND[i].comp].nombre)} · ${esc(IND[i].nombre)}</td><td class="num">${n}</td></tr>`).join('')}</table></div>
   <div><h3>Normas y estándares citados</h3><table>${Object.entries(normas).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n, c]) => `<tr><td>${esc(n)}</td><td class="num">${c}</td></tr>`).join('') || '<tr><td class="muted">Ninguna detectada</td></tr>'}</table></div></div>`;
  const filtro = $('#carac-filtro'); const v = filtro.value;
  filtro.innerHTML = '<option value="">Todos los indicadores sugeridos</option>' + Object.keys(cont).map(i => `<option value="${i}">${esc(IND[i].nombre)}</option>`).join(''); filtro.value = v;
  renderCaracTabla();
}
function renderCaracTabla() {
  const fi = $('#carac-filtro').value, solo = $('#carac-solo-sel').checked;
  const F = fragsTodos().filter(f => (!fi || f.ind === fi) && (!solo || f.sel));
  const opts = Object.entries(IND).map(([id, x]) => `<option value="${id}">${esc(x.comp)} · ${esc(x.nombre)}</option>`).join('');
  $('#carac-tabla').innerHTML = `<div class="actions" style="margin:0 0 8px"><button class="ghost" id="sel-todo">Seleccionar visibles</button><button class="ghost" id="sel-nada">Quitar selección visible</button></div>
   <table><tr><th></th><th>Fragmento</th><th>Indicador sugerido</th><th>Tipo · normas</th></tr>` + F.slice(0, 400).map(f => `<tr><td><input type="checkbox" data-f="${esc(f.id)}" ${f.sel ? 'checked' : ''}></td>
   <td><div class="muted">${esc(f.doc)}</div><div class="frag">${esc(f.texto)}</div></td>
   <td><select data-fi="${esc(f.id)}">${opts}</select><div class="muted">puntaje ${f.conf}${f.alt.length ? ' · alt: ' + f.alt.join(', ') : ''}</div></td>
   <td>${esc(f.tipo)}<div class="muted">${esc(f.normas.join('; '))}</div></td></tr>`).join('') + '</table>' + (F.length > 400 ? `<p class="muted">Se muestran 400 de ${F.length}; usa el filtro.</p>` : '');
  F.slice(0, 400).forEach(f => { const s = $(`select[data-fi="${CSS.escape(f.id)}"]`); if (s) s.value = f.ind; });
  const byId = Object.fromEntries(fragsTodos().map(f => [f.id, f]));
  $('#carac-tabla').onchange = e => { if (e.target.dataset.f) byId[e.target.dataset.f].sel = e.target.checked; if (e.target.dataset.fi) byId[e.target.dataset.fi].ind = e.target.value; renderCaracResumenSel(); };
  $('#sel-todo').onclick = () => { F.forEach(f => f.sel = true); renderCaracTabla(); renderCaracResumenSel(); };
  $('#sel-nada').onclick = () => { F.forEach(f => f.sel = false); renderCaracTabla(); renderCaracResumenSel(); };
}
function renderCaracResumenSel() { const p = $('#carac-resumen p strong:last-child'); if (p) p.textContent = fragsTodos().filter(f => f.sel).length; }
$('#carac-filtro').addEventListener('change', renderCaracTabla);
$('#carac-solo-sel').addEventListener('change', renderCaracTabla);

/* ---------- generación ---------- */
const motorSel = $('#gen-motor');
function actualizarMotor() {
  const m = motorSel.value, ia = m !== 'offline';
  $('#lbl-key').classList.toggle('hidden', !ia); $('#lbl-modelo').classList.toggle('hidden', !ia);
  if (ia) { $('#gen-key').value = store.get('key.' + m, ''); $('#gen-modelo').value = store.get('modelo.' + m, m === 'gemini' ? 'gemini-2.5-flash' : 'claude-sonnet-4-5'); }
}
motorSel.addEventListener('change', actualizarMotor); actualizarMotor();

function promptIA(frag, n) {
  const ind = IND[frag.ind], comp = COMP[ind.comp];
  const esComp = comp.prueba === 'comportamentales';
  return `Eres un constructor experto de ítems para pruebas escritas de concursos de méritos en Colombia. Construye ${n} ítem(s) ORIGINALES para el Proceso de Selección del Instituto Nacional de Medicina Legal y Ciencias Forenses (INMLCF) 2026, siguiendo el Anexo Técnico:
- Modelo de juicio situacional: cada ítem tiene UN (1) enunciado y TRES (3) opciones de respuesta, con una única clave.
- El enunciado presenta una situación contextualizada y pertinente al ámbito de evaluación, que incluye de manera explícita el incidente crítico; no se construyen casos independientes: todo va dentro del enunciado.
- El enunciado puede terminar en pregunta o quedar incompleto para que la opción lo complete.
- Opciones homogéneas en longitud y estructura, plausibles, sin "todas/ninguna de las anteriores", sin pistas gramaticales.
- ${esComp ? 'Prueba COMPORTAMENTAL (componente ' + comp.nombre + '): las tres opciones son conductas socialmente aceptables; la clave es la que mejor refleja la conducta asociada a la competencia o valor "' + ind.nombre + '". No evalúes conocimientos normativos.' : 'Prueba de COMPETENCIAS FUNCIONALES (componente ' + comp.nombre + ', indicador "' + ind.nombre + '"): evalúa la aplicación del conocimiento del texto a una situación laboral del INMLCF, no la memoria literal.'}
- Basa el contenido SOLO en el texto fuente; no inventes datos normativos que no estén en él.
- Incluye una justificación breve de la clave y de por qué cada distractor es incorrecto.
Responde ÚNICAMENTE con un arreglo JSON, sin texto adicional, con objetos de esta forma:
[{"eje":"eje temático breve","enunciado":"...","opciones":["...","...","..."],"clave":0,"just":"..."}]
(clave = índice 0, 1 o 2 de la opción correcta; varía la posición de la clave).

Documento: ${frag.doc}
TEXTO FUENTE:
"""${frag.texto.slice(0, 3500)}"""`;
}
async function llamarIA(motor, key, modelo, prompt) {
  if (motor === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, responseMimeType: 'application/json' } }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || r.status);
    return d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: modelo, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || r.status);
  return (d.content || []).map(c => c.text || '').join('');
}
function parseJSONArray(txt) {
  const a = txt.indexOf('['), b = txt.lastIndexOf(']');
  if (a < 0 || b < a) throw new Error('La respuesta no contiene JSON');
  return JSON.parse(txt.slice(a, b + 1));
}

/* Borrador automático sin conexión: ítem de completar a partir de una oración clave */
function generarOffline(frag, n, pool) {
  const oraciones = frag.texto.split(/(?<=[.;:])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/).map(s => s.trim()).filter(s => s.length > 60 && s.length < 420 && s !== s.toUpperCase());
  const RE_NUM = /\b(\d+|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|treinta)\s*(?:\(\d+\)\s*)?(d[íi]as(?:\s+h[áa]biles)?|meses|años|horas|minutos|%|por ciento)/i;
  const terminos = KW[frag.ind] || [];
  const out = [];
  const prioridad = s => (RE_NUM.test(s) ? 0 : (s.match(RE_NORMA) ? 1 : 2)) + Math.random() * 0.5;
  const ordenadas = oraciones.map(s => [prioridad(s), s]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const usadas = new Set();
  for (const s of ordenadas) {
    if (out.length >= n) break;
    let target = null, distract = [];
    const mN = s.match(RE_NUM);
    const mNorma = s.match(RE_NORMA);
    const mTerm = terminos.find(t => t.length > 5 && s.toLowerCase().includes(t));
    if (mN) {
      target = mN[0]; const unidad = mN[2];
      distract = [...new Set((pool.match(new RegExp(RE_NUM.source, 'gi')) || []).filter(x => x.toLowerCase() !== target.toLowerCase() && x.toLowerCase().includes(unidad.toLowerCase().slice(0, 3))))];
      if (distract.length < 2) { const v = parseInt(mN[1]); if (!isNaN(v)) distract.push(`${v * 2} ${unidad}`, `${v + 5} ${unidad}`); }
    } else if (mNorma) {
      target = mNorma[0]; distract = [...new Set((pool.match(RE_NORMA) || []).filter(x => x.replace(/\s+/g, ' ') !== target.replace(/\s+/g, ' ')))];
    } else if (mTerm) {
      const i = s.toLowerCase().indexOf(mTerm); target = s.substr(i, mTerm.length);
      const mismoEje = (KW[frag.ind] || []).filter(w => w !== mTerm && w.length > 5);
      distract = mismoEje.filter(w => pool.toLowerCase().includes(w));
      if (distract.length < 2) distract = mismoEje;
    }
    if (!target || distract.length < 2) continue;
    if (usadas.has(target.toLowerCase())) continue; usadas.add(target.toLowerCase());
    const norm = x => mTerm && !mN && !mNorma ? x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() : x;
    target = norm(target);
    const ds = shuffle(distract).slice(0, 2).map(norm);
    const blank = s.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '________');
    const clave = Math.floor(Math.random() * 3);
    const opciones = shuffle(ds); opciones.splice(clave, 0, target);
    out.push({ eje: IND[frag.ind].nombre, enunciado: `Un servidor del Instituto revisa «${frag.doc.replace(/\.[^.]+$/, '')}» para resolver una situación de su trabajo relacionada con el eje «${IND[frag.ind].nombre}». Según el documento: "${blank}". La expresión que completa correctamente el texto es`, opciones, clave, just: `Borrador automático: la clave proviene literalmente del texto fuente ("${s}"). Los distractores son términos del mismo documento o del área. Revísalo y conviértelo en situación de juicio situacional antes de usarlo como práctica definitiva.`, borrador: true });
  }
  return out;
}

$('#btn-generar').addEventListener('click', async () => {
  const sel = fragsTodos().filter(f => f.sel);
  if (!sel.length) { alert('Selecciona al menos un fragmento en la tabla de caracterización.'); return; }
  const motor = motorSel.value, n = Math.min(5, Math.max(1, +$('#gen-n').value || 1));
  const key = $('#gen-key').value.trim(), modelo = $('#gen-modelo').value.trim();
  if (motor !== 'offline') {
    if (!key) { alert('Ingresa tu API key.'); return; }
    store.set('key.' + motor, key); store.set('modelo.' + motor, modelo);
    if (sel.length > 30 && !confirm(`Vas a enviar ${sel.length} fragmentos a la IA (${sel.length} llamadas). ¿Continuar?`)) return;
  }
  const salida = $('#gen-salida'); salida.innerHTML = '<p class="muted">Generando…</p>';
  const nuevos = []; let errores = 0;
  for (const [k, f] of sel.entries()) {
    salida.firstElementChild.textContent = `Generando… ${k + 1}/${sel.length}`;
    try {
      let arr;
      if (motor === 'offline') arr = generarOffline(f, n, DOCS.find(d => d.nombre === f.doc)?.texto || f.texto);
      else arr = parseJSONArray(await llamarIA(motor, key, modelo, promptIA(f, n)));
      arr.forEach(x => { const it = normalizarItem({ ...x, ind: f.ind, comp: IND[f.ind].comp, fuente: `${f.doc} (${motor === 'offline' ? 'borrador automático' : motor})` }); if (it) nuevos.push(it); else errores++; });
    } catch (err) { errores++; console.error(err); if (motor !== 'offline' && k === 0) { salida.innerHTML = `<p class="pill bad">Error con la IA: ${esc(err.message)}</p>`; return; } }
  }
  salida.innerHTML = `<p><strong>${nuevos.length}</strong> ítems generados${errores ? ` (${errores} descartados o con error)` : ''}. Revisa y guarda los que quieras.</p>
   <div class="actions"><button class="primary" id="gen-guardar-todo">Guardar todos en mi banco</button></div>` +
    nuevos.map((it, i) => `<div class="item-row" data-g="${i}"><div class="qmeta"><span class="pill">${esc(COMP[it.comp].nombre)}</span><span class="pill">${esc(IND[it.ind].nombre)}</span>${it.borrador ? '<span class="pill warn">borrador</span>' : ''}</div>
     <p>${esc(it.enunciado)}</p><ol type="A">${it.opciones.map((o, j) => `<li${j === it.clave ? ' style="font-weight:600;color:var(--ok)"' : ''}>${esc(o)}</li>`).join('')}</ol><div class="just">${esc(it.just)}</div>
     <div class="actions"><button data-guardar="${i}">Guardar</button><button class="ghost" data-descartar="${i}">Descartar</button></div></div>`).join('');
  const guardados = new Set();
  salida.onclick = e => {
    const g = e.target.dataset.guardar, d = e.target.dataset.descartar;
    if (g !== undefined && !guardados.has(+g)) { personal.push(nuevos[+g]); guardados.add(+g); store.set('personal', personal); e.target.textContent = 'Guardado ✔'; e.target.disabled = true; previewEstructura(); }
    if (d !== undefined) e.target.closest('.item-row').remove();
    if (e.target.id === 'gen-guardar-todo') { const vis = $$('.item-row[data-g]', salida).map(r => +r.dataset.g).filter(i => !guardados.has(i)); vis.forEach(i => { personal.push(nuevos[i]); guardados.add(i); }); store.set('personal', personal); e.target.textContent = `Guardados ${vis.length} ✔`; previewEstructura(); }
  };
});

/* ---------- guía ---------- */
$('#guia').innerHTML = `<h2>Cómo están construidas estas pruebas</h2>
<h3>1. Lo que fija el Anexo Técnico del INMLCF (LP-004-SG-2026)</h3>
<ul>
<li><strong>Dos pruebas escritas</strong>: competencias funcionales (eliminatoria, mínimo 65,00) y competencias comportamentales con componente de integridad (clasificatoria).</li>
<li><strong>Ponderación</strong>: grupos 1 y 2 → 65 % funcionales y 35 % comportamentales. Grupos 3 y 4 → 50 %, 30 % y 20 % valoración de antecedentes.</li>
<li><strong>Formato de ítem</strong>: juicio situacional, un enunciado y tres opciones de respuesta. El incidente crítico va dentro del enunciado; no hay casos independientes.</li>
<li><strong>Profesional y técnico</strong>: 145 ítems = 90 funcionales (18 conocimientos generales, 48 específicos, 12 habilidades, 12 aptitudes) + 55 comportamentales (25 comunes, 5 transversales, 5 por nivel, 20 valores de integridad).</li>
<li><strong>Asistencial</strong>: 109 ítems = 54 funcionales + 55 comportamentales.</li>
<li><strong>Integridad</strong>: valores del Código de Integridad adoptado por la Resolución 406 de 2019 del Instituto (honestidad, respeto, compromiso, diligencia y justicia).</li>
<li><strong>Calificación</strong>: escala de 0,00 a 100,00 con dos decimales truncados; listas de elegibles en estricto orden de mérito.</li>
<li>Los ítems reales son inéditos: el operador debe garantizar que no se hayan usado en concursos de la CNSC ni de la Fiscalía.</li>
</ul>
<h3>2. La lógica de los simulacros de Misión Mérito</h3>
<ul>
<li><strong>Funcionales y básicas</strong> (formularios): entre 3 y 4 casos por simulacro. Cada caso trae un contexto de 500 a 700 caracteres y de 3 a 5 preguntas de 3 opciones, 1 punto cada una. La pregunta suele ser un enunciado incompleto ("…usted concluye que la solicitud…").</li>
<li><strong>Comportamentales</strong> (juicio situacional): 3 casos con 4 preguntas. Las tres opciones son conductas aceptables y la clave es la más alineada con la competencia.</li>
<li><strong>Integridad</strong>: 4 casos con 3 preguntas. Enunciados para completar, con un dilema ético, por ejemplo un vínculo familiar o una dádiva.</li>
<li><strong>Likert</strong> (DIAN): 30 afirmaciones con escala de 4 puntos, mezclando ítems directos e inversos por competencia.</li>
<li><strong>Razonamiento analítico</strong>: 20 casos de un solo ítem con 4 opciones y solución explicada. Cubre series, proporcionalidad, porcentajes, promedios ponderados, conjuntos, ordenamiento, probabilidad, silogismos categóricos y lectura de tablas. Algunos casos incluyen datos que sobran.</li>
</ul>
<h3>3. Cómo se combinaron en este simulador</h3>
<ul>
<li>Se usa el formato del Anexo (un enunciado autocontenido con 3 opciones) y la cantidad exacta de ítems por componente e indicador.</li>
<li>Del estilo de Misión Mérito se toman los <em>casos</em> (modo "Casos estilo Misión Mérito"), la hoja de respuestas, la retroalimentación inmediata y la justificación de la clave y los distractores.</li>
<li>Los razonamientos analítico y cuantitativo se ubican en <em>Aptitudes</em>, y la comprensión de textos y el análisis de información en <em>Habilidades</em>.</li>
<li>Los indicadores son una propuesta. Los definitivos los fija la "Matriz de Estructura de Pruebas Escritas" del INMLCF; puedes ajustarlos en <code>data/estructura.json</code>.</li>
</ul>
<h3>4. Cargar documentos</h3>
<ol><li>En "Documentos", sube PDF, DOCX o TXT: el MEFCL de tu empleo, normas, manuales o procedimientos.</li>
<li>Revisa la caracterización. Cada fragmento recibe un indicador sugerido, con su tipo (normativo, definición o procedimiento) y las normas que cita. Corrige el indicador si hace falta.</li>
<li>Genera los ítems. Con IA (Gemini o Claude, usando tu clave) obtienes ítems de juicio situacional con justificación. El modo sin conexión crea borradores para completar el enunciado.</li>
<li>Guárdalos en tu banco personal: entrarán a los simulacros por su indicador. Expórtalos en JSON para respaldarlos o pasarlos a otro dispositivo.</li></ol>`;

previewEstructura();
})();
