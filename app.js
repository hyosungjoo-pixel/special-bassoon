/*
 * Inside Me — app shell. Renders whatever the packs registered; knows no anatomy itself.
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const $ = s => document.querySelector(s);
  const esc = A.draw.esc;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const val = (v, ...args) => (typeof v === 'function' ? v(...args) : v);

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }

  const readLS = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };

  // ---------- Per-viewer display preferences ----------
  const PREFS_KEY = 'insideme.prefs.v1';
  const prefs = Object.assign({ temp: 'C', glucose: 'mmol', grownup: true, speed: 60 }, readLS(PREFS_KEY) || {});
  const savePrefs = () => writeLS(PREFS_KEY, prefs);

  // ---------- Bodies ----------
  const LS_KEY = 'insideme.bodies.v1';
  const LOG_CAP = 300;
  let bodies = {};
  let body = null;
  let s = null;
  const store = { mode: 'local', db: null, uid: null, writing: {}, again: {}, refused: false };

  function newBody(name, age, example) {
    const b = { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, age, species: 'human', created: Date.now(), updated: Date.now(), example: !!example, log: [] };
    b.sim = A.sim.create(b);
    return b;
  }

  function exampleBody() {
    const b = newBody('Sam', 8, true);
    b.sim.t = 12 * 3600;
    const ctx = { body: b, log: (text, o) => b.log.push(Object.assign({ t: b.sim.t, text }, o)), germs: A.germs };
    A.actions.find(a => a.id === 'eat').run(b.sim, ctx, 'lunch');
    A.sim.step(b.sim, b, 25 * 60, ctx.log);
    return b;
  }

  function hydrate(b) {
    b.log = Array.isArray(b.log) ? b.log : [];
    b.sim = b.sim && typeof b.sim === 'object' ? b.sim : A.sim.create(b);
    A.sim.hydrate(b.sim, b);
    return b;
  }

  function useBody(b) {
    body = b;
    s = b.sim;
    renderWho();
    if (stageReady) { go(current, { instant: true, force: true }); }
  }

  function persist(b) {
    b = b || body;
    if (!b || b.example) return;
    b.updated = Date.now();
    if (b.log.length > LOG_CAP) b.log = b.log.slice(-LOG_CAP);
    const real = {};
    Object.values(bodies).forEach(x => { if (!x.example) real[x.id] = x; });
    writeLS(LS_KEY, { bodies: real, current: body && !body.example ? body.id : null });
    if (store.db && store.uid && !store.refused) writeCloud(b);
    lastSave = { t: b.sim.t, n: b.log.length };
  }

  function writeCloud(b) {
    if (store.writing[b.id]) { store.again[b.id] = true; return; }
    store.writing[b.id] = true;
    const doc = JSON.parse(JSON.stringify(b));
    store.db.doc(`data/users/${store.uid}/bodies/${b.id}`).set(doc).then(() => {
      store.mode = 'cloud';
    }).catch(e => {
      if (e && e.code === 'invalid_argument') store.refused = true;
      store.mode = 'local';
    }).finally(() => {
      store.writing[b.id] = false;
      if (store.again[b.id]) { store.again[b.id] = false; writeCloud(b); }
    });
  }

  async function connectCloud() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      store.db = db; store.uid = uid;
      const snap = await db.collection(`data/users/${uid}/bodies`).limit(50).get();
      const cloud = {};
      snap.docs.forEach(d => { if (d.exists) cloud[d.id] = d.data(); });
      store.mode = 'cloud';
      for (const b of Object.values(bodies)) {
        if (!b.example && (!cloud[b.id] || (cloud[b.id].updated || 0) < (b.updated || 0))) writeCloud(b);
      }
      let switchTo = null;
      for (const [id, cb] of Object.entries(cloud)) {
        if (!bodies[id] || (bodies[id].updated || 0) < (cb.updated || 0)) {
          bodies[id] = hydrate(cb);
          if (body && body.id === id) switchTo = bodies[id];
        }
      }
      const reals = Object.values(bodies).filter(b => !b.example).sort((a, b) => (b.updated || 0) - (a.updated || 0));
      if (body.example && reals.length) { delete bodies[body.id]; switchTo = reals[0]; }
      if (switchTo) useBody(switchTo);
      renderFirstRun();
    } catch (e) { /* stay on this browser's copy */ }
  }

  // ---------- Logging ----------
  function logFn(text, opts) {
    body.log.push(Object.assign({ t: s.t, text }, opts || {}));
    if (body.log.length > LOG_CAP) body.log.splice(0, body.log.length - LOG_CAP);
    journalDirty = true;
  }

  // ---------- Time ----------
  const SPEEDS = [[0, 'Pause'], [1, 'Real time'], [60, '1 min/sec'], [3600, '1 hour/sec']];
  let speed = SPEEDS.some(x => x[0] === prefs.speed) ? prefs.speed : 60;
  let ff = null; // fast-forward: { until, restore }
  function setSpeed(v, remember) {
    speed = v;
    if (remember !== false) { prefs.speed = v; savePrefs(); }
    document.querySelectorAll('#speed button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === v)));
  }
  function renderSpeed() {
    const wrap = $('#speed');
    wrap.innerHTML = '';
    SPEEDS.forEach(([v, lab]) => wrap.append(el('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === speed), onclick: () => { ff = null; setSpeed(v); } }, lab)));
  }

  // ---------- Stage ----------
  let current = 'body';
  let layer = null;
  let stageReady = false;
  const view = $('#view');
  const spotsEl = $('#spots');
  const norms = () => A.norms(body);

  function vb(n) { return (n.viewBox || '0 0 800 600').split(/\s+/).map(Number); }

  function buildLayer(n) {
    const wrap = el('div', { class: 'layer' });
    const nm = norms();
    const dctx = { s, body, norms: nm };
    const parts = n.layers.map((L, i) => `<g data-layer="${i}">${L.draw ? L.draw(dctx) : ''}</g>`).join('');
    const spots = n.hotspots.map((h, i) => {
      const link = A.nodes[h.to] && A.nodes[h.to].parent !== n.id ? ' link' : '';
      const [x, y] = h.at, [ax, ay] = h.anchor || h.at;
      return `<g data-spot="${i}"><path class="leader${link}" d="M${x},${y} L${ax},${ay}"/><circle class="ring${link}" cx="${x}" cy="${y}" r="13"/><circle class="ring-pulse${link}" cx="${x}" cy="${y}" r="13"/></g>`;
    }).join('');
    wrap.innerHTML = `<svg viewBox="${vb(n).join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(n.name)}">${parts}<g class="spotlayer">${spots}</g></svg>`;
    const svg = wrap.firstElementChild;
    const ctxs = n.layers.map(L => ({ L, mem: {} }));
    return { wrap, svg, ctxs, node: n };
  }

  // Map a point in a node's viewBox to pixels inside the view element.
  function toPx(n, x, y) {
    const r = view.getBoundingClientRect();
    const [vx, vy, vw, vh] = vb(n);
    const k = Math.min(r.width / vw, r.height / vh);
    return [(r.width - vw * k) / 2 + (x - vx) * k, (r.height - vh * k) / 2 + (y - vy) * k];
  }

  function placeSpots() {
    if (!layer) return;
    spotsEl.querySelectorAll('.spot').forEach(b => {
      const h = layer.node.hotspots[+b.dataset.i];
      let [px, py] = toPx(layer.node, ...(h.anchor || h.at));
      // Keep every label fully inside the stage on narrow screens.
      const w = b.offsetWidth, W = view.clientWidth, side = h.side || 'right';
      const left = side === 'left' ? px - w : side === 'right' ? px : px - w / 2;
      const fix = Math.max(4 - left, 0) - Math.max(left + w - (W - 4), 0);
      px += fix;
      b.style.left = px + 'px';
      b.style.top = py + 'px';
    });
  }

  function renderSpots() {
    spotsEl.innerHTML = '';
    const n = layer.node;
    n.hotspots.forEach((h, i) => {
      const target = A.nodes[h.to];
      if (!target) return;
      const link = target.parent !== n.id;
      const b = el('button', {
        type: 'button', class: `spot side-${h.side || 'right'}${link ? ' link' : ''}`, 'data-i': i,
        'aria-label': `${link ? 'Go to' : 'Zoom into'} ${h.label || target.name}`,
        onclick: () => go(h.to),
        onmouseenter: () => hot(i, true), onmouseleave: () => hot(i, false),
        onfocus: () => hot(i, true), onblur: () => hot(i, false),
      }, el('span', { class: 'ic', 'aria-hidden': 'true' }, link ? '→' : '+'), h.label || target.name);
      spotsEl.append(b);
    });
    placeSpots();
  }
  function hot(i, on) {
    const g = layer && layer.svg.querySelector(`[data-spot="${i}"]`);
    if (g) g.classList.toggle('hot', on);
  }

  const isAncestor = (a, b) => A.path(b).some(n => n.id === a) && a !== b;
  function stepToward(from, to) {
    const p = A.path(to).map(n => n.id);
    const i = p.indexOf(from);
    return i >= 0 ? p[i + 1] : null;
  }
  function spotPoint(n, childId) {
    const h = n.hotspots.find(x => x.to === childId);
    return h ? toPx(n, ...h.at) : null;
  }

  function go(id, opt) {
    opt = opt || {};
    const n = A.nodes[id];
    if (!n || (id === current && !opt.force)) return;
    const prev = current;
    current = id;
    const old = layer;
    layer = buildLayer(n);
    view.insertBefore(layer.wrap, spotsEl);
    if (old) {
      const anim = !reduced && !opt.instant;
      if (anim) {
        const r = view.getBoundingClientRect();
        const center = `${r.width / 2}px ${r.height / 2}px`;
        const deeper = isAncestor(prev, id), shallower = isAncestor(id, prev);
        let o1 = center, o2 = center, f1 = 'scale(.92)', t2 = 'scale(1.08)';
        if (deeper) {
          const p = spotPoint(old.node, stepToward(prev, id));
          if (p) o1 = `${p[0]}px ${p[1]}px`;
          f1 = 'scale(4)'; t2 = 'scale(.35)';
        } else if (shallower) {
          const p = spotPoint(n, stepToward(id, prev));
          if (p) o2 = `${p[0]}px ${p[1]}px`;
          f1 = 'scale(.35)'; t2 = 'scale(4)';
        }
        old.wrap.style.transformOrigin = o1;
        layer.wrap.style.transformOrigin = o2;
        old.wrap.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: f1, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' });
        layer.wrap.animate([{ transform: t2, opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.55,0,.25,1)' });
        setTimeout(() => old.wrap.remove(), 700);
      } else old.wrap.remove();
    }
    renderSpots();
    renderCrumbs();
    renderPanel();
    renderLadder();
    if (opt.focusSpot !== false && !opt.instant) {
      const first = spotsEl.querySelector('.spot');
      if (first && document.activeElement && document.activeElement.classList.contains('spot')) first.focus({ preventScroll: true });
    }
  }

  function zoomOut() {
    const n = A.nodes[current];
    if (n && n.parent) go(n.parent);
  }

  function renderCrumbs() {
    const nav = $('#crumbs');
    nav.innerHTML = '';
    const p = A.path(current);
    p.forEach((n, i) => {
      if (i) nav.append(el('span', { class: 'sep', 'aria-hidden': 'true' }, '›'));
      nav.append(el('button', { type: 'button', 'aria-current': i === p.length - 1 ? 'page' : null, onclick: () => go(n.id) }, n.name));
    });
    $('#zoomOut').hidden = p.length < 2;
  }

  function renderLadder() {
    const lad = $('#ladder');
    lad.innerHTML = '';
    const sc = A.nodes[current].scale;
    A.SCALES.forEach(x => lad.append(el('span', { 'aria-current': x.id === sc ? 'step' : null }, x.label)));
  }

  // ---------- Narration panel ----------
  let samplePromise = null;
  const getSample = () => (samplePromise = samplePromise || (window.claude && typeof window.claude.use === 'function' ? window.claude.use('sample').catch(() => null) : Promise.resolve(null)));

  const fill = str => A.say(str, body).replace(/\{hr\}/g, Math.round(s.hr));

  function nowText(n) {
    const nm = norms();
    const parts = [];
    if (n.now) parts.push(n.now(s, body, nm));
    n.nowExtra.forEach(f => parts.push(f(s, body, nm)));
    return parts.filter(Boolean).join(' ');
  }

  function renderPanel() {
    const n = A.nodes[current];
    const nm = norms();
    const panel = $('#panel');
    panel.innerHTML = '';
    const scale = A.SCALES.find(x => x.id === n.scale);
    panel.append(el('p', { class: 'eyebrow' }, el('span', {}, scale ? scale.label : n.scale),
      n.systems.map(id => A.systems[id] ? el('span', { class: 'sys', 'data-sys': id }, A.systems[id].name) : null)));
    panel.append(el('h1', {}, n.name));
    if (n.size) panel.append(el('p', { class: 'size' }, val(n.size, nm, body)));
    panel.append(el('div', { class: 'say' }, el('span', { class: 'tag' }, 'Say it'), el('p', {}, fill(n.kid))));
    panel.append(el('p', { class: 'now' }, el('span', {}, el('b', {}, `Right now in ${body.name}: `), el('span', { id: 'nowLine' }, nowText(n)))));

    const targets = [];
    n.hotspots.forEach(h => { if (A.nodes[h.to] && !targets.some(t => t.id === h.to)) targets.push({ id: h.to, label: h.label || A.nodes[h.to].name }); });
    A.children(n.id).forEach(c => { if (!targets.some(t => t.id === c.id)) targets.push({ id: c.id, label: c.name }); });
    const deeper = targets.filter(t => A.nodes[t.id].parent === n.id);
    const links = targets.filter(t => A.nodes[t.id].parent !== n.id);
    if (deeper.length || links.length) {
      panel.append(el('div', { class: 'deeper' },
        deeper.map(t => el('button', { type: 'button', onclick: () => go(t.id) }, '+ ', t.label)),
        links.map(t => el('button', { type: 'button', class: 'link', onclick: () => go(t.id) }, '→ ', t.label))));
    }
    if (n.notYet) panel.append(el('p', { class: 'notyet' }, `Not built yet: ${n.notYet}. This is where future topic packs plug in.`));

    const fy = el('details', { class: 'foryou', open: prefs.grownup });
    fy.addEventListener('toggle', () => { prefs.grownup = fy.open; savePrefs(); });
    fy.append(el('summary', {}, 'For you: the real science'));
    fy.append(el('div', { class: 'science', html: n.adult || '' }));
    if (n.numbers.length) {
      fy.append(el('span', { class: 'section-title' }, 'Real numbers'));
      fy.append(el('table', { class: 'numbers' }, el('tbody', {}, n.numbers.map(x => el('tr', {},
        el('td', {}, val(x.value, nm, body)),
        el('td', {}, val(x.what, nm, body), x.who && x.who !== 'any' ? el('span', { class: 'who-tag' }, x.who === 'kid' ? `${nm.age} yrs` : x.who) : null,
          x.src ? el('span', { class: 'meta' }, x.src) : null))))));
    }
    if (n.words.length) {
      fy.append(el('span', { class: 'section-title' }, 'Words to use'));
      fy.append(el('dl', { class: 'words' }, n.words.map(([w, d]) => [el('dt', {}, w), el('dd', {}, d)])));
    }
    if (n.myths.length) {
      fy.append(el('span', { class: 'section-title' }, 'Myth check'));
      n.myths.forEach(m => fy.append(el('div', { class: 'myth' }, el('p', { class: 'm' }, m.myth), el('p', { class: 't' }, m.truth))));
    }
    if (n.simplified) {
      fy.append(el('span', { class: 'section-title' }, 'What we simplified'));
      fy.append(el('p', { class: 'simpl' }, n.simplified));
    }
    if (n.whys.length) {
      fy.append(el('span', { class: 'section-title' }, '"Why?" questions'));
      fy.append(el('div', { class: 'whys' }, n.whys.map(w => el('details', {}, el('summary', {}, w.q), el('p', {}, fill(w.a))))));
    }
    const ask = el('div', { class: 'ask', hidden: true });
    fy.append(ask);
    panel.append(fy);
    panel.scrollTop = 0;
    getSample().then(sample => { if (sample && A.nodes[current] === n) buildAsk(ask, n, sample); });
  }

  let askAbort = null;
  function buildAsk(box, n, sample) {
    box.hidden = false;
    box.innerHTML = '';
    const out = el('p', { class: 'answer', hidden: true });
    const input = el('input', { id: 'askInput', type: 'text', placeholder: `Ask a "why" about the ${n.name.toLowerCase()}`, maxlength: 200, autocomplete: 'off', 'aria-label': 'Your question' });
    const btn = el('button', { class: 'btn primary', type: 'submit' }, 'Ask Claude');
    const form = el('form', {}, input, btn);
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const q = input.value.trim();
      if (!q) { input.focus(); return; }
      if (askAbort) askAbort.abort();
      askAbort = new AbortController();
      out.hidden = false;
      out.textContent = 'Thinking…';
      btn.disabled = true;
      const nm = norms();
      const plain = (n.adult || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const nums = n.numbers.map(x => `${val(x.value, nm, body)}: ${val(x.what, nm, body)}`).join('; ');
      const prompt = `A parent and their ${nm.age}-year-old are exploring the human body together on a TV. They are looking at: ${n.name} (zoom level: ${n.scale}).
Background the parent already has: ${plain}
Key numbers: ${nums}
The child asked: "${q}"

Answer in plain text, no markdown, in exactly this shape:
Say it: 1 to 3 short sentences the parent can read aloud to a ${nm.age}-year-old. Warm and concrete, never babyish.
For you: 2 to 5 sentences of accurate science for the parent, with real numbers where they help.
Simplified: one sentence naming what the "Say it" part leaves out (omit this line if nothing is left out).

Rules: be accurate and current. Never repeat myths (for example, blood is never blue). If scientists don't know, say so. If the question is about the child's own symptoms or health, give general information and suggest asking a doctor; do not diagnose.`;
      try {
        const res = await sample(prompt, { signal: askAbort.signal, modelTier: 'default', onText: u => { out.textContent = u.text; } });
        out.textContent = res.text;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        if (e && (e.code === 'not_granted')) { box.hidden = true; return; }
        out.textContent = e && e.code === 'rate_limited' ? 'Too many questions at once. Try again in a minute.' : 'Claude could not answer that just now. Try again in a moment.';
      } finally { btn.disabled = false; }
    });
    box.append(el('span', { class: 'section-title' }, 'Ask your own "why?"'), form, out,
      el('p', { class: 'small' }, 'Answers come from Claude and can be wrong. Check anything about your child\'s health with a doctor.'));
  }

  // ---------- Vitals ----------
  function renderVitals() {
    const wrap = $('#vitals');
    wrap.innerHTML = '';
    A.vitals.forEach(v => {
      wrap.append(el('button', { type: 'button', class: 'vital', 'data-id': v.id, onclick: () => v.node && go(v.node), title: v.node ? `Go to ${A.nodes[v.node] ? A.nodes[v.node].name : v.node}` : null },
        el('span', { class: 'lab' }, v.pulse ? el('span', { html: '<svg class="pulse" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" style="fill:currentColor"/></svg>' }) : null, v.label),
        el('span', { class: 'val' }, '–'), el('span', { class: 'unit' }, '')));
    });
  }
  let lastBeat = 0;
  function updateVitals() {
    const nm = norms();
    A.vitals.forEach(v => {
      const b = document.querySelector(`.vital[data-id="${v.id}"]`);
      if (!b) return;
      const x = v.value(s, nm);
      b.querySelector('.val').textContent = v.fmt(x, prefs);
      b.querySelector('.unit').textContent = val(v.unit, prefs);
      b.dataset.status = v.status ? v.status(x, s, nm) : 'ok';
      if (v.pulse && Math.abs(x - lastBeat) > 2) {
        lastBeat = x;
        const p = b.querySelector('.pulse');
        if (p) p.style.setProperty('--beat', (60 / Math.max(30, x)).toFixed(3) + 's');
      }
    });
    $('#clock').textContent = A.clock(s.t).text;
  }

  // ---------- Happening now ----------
  let lastHappening = '';
  function updateHappening() {
    const items = A.sim.happening(s, body);
    const key = items.map(i => i.text + i.node).join('|');
    if (key === lastHappening) return;
    lastHappening = key;
    const ul = $('#happening');
    const focused = document.activeElement && ul.contains(document.activeElement) ? document.activeElement.dataset.node : null;
    ul.innerHTML = '';
    if (!items.length) ul.append(el('li', { class: 'none' }, `${body.name} is resting. Try one of the buttons below.`));
    items.forEach(i => ul.append(el('li', {}, el('button', { type: 'button', class: 'chip', 'data-sys': i.sys || '', 'data-node': i.node, onclick: () => go(i.node) }, i.text, ' →'))));
    if (focused) { const b = ul.querySelector(`[data-node="${focused}"]`); if (b) b.focus({ preventScroll: true }); }
  }

  // ---------- Callout ----------
  let calloutTimer = null;
  function callout(text, nodeId) {
    const c = $('#callout');
    c.innerHTML = '';
    c.append(el('p', {}, text));
    if (nodeId && A.nodes[nodeId] && nodeId !== current) c.append(el('button', { class: 'btn primary', type: 'button', onclick: () => { c.hidden = true; go(nodeId); } }, `Go see: ${A.nodes[nodeId].name}`));
    c.append(el('button', { class: 'btn', type: 'button', 'aria-label': 'Dismiss', onclick: () => { c.hidden = true; } }, '✕'));
    c.hidden = false;
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => { c.hidden = true; }, 14000);
  }

  // ---------- Actions ----------
  const ICONS = {
    run: '<path d="M13 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0M9 21l3-6 3 2v5M7 12l3-4 4 1 3 4 3 1M12 8l-2 7"/>',
    eat: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    germ: '<circle cx="12" cy="12" r="5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    book: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>',
  };
  const icon = id => el('span', { html: `<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${ICONS[id] || ICONS.play}</svg>`, style: 'display:contents' });

  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }

  function runAction(a, opt) {
    closeMenu();
    const why = a.blocked && a.blocked(s);
    if (why) { callout(why); return; }
    const ctx = { body, log: logFn, germs: A.germs, norms: norms() };
    const res = a.run(s, ctx, opt) || {};
    if (res.fastForwardUntil) { ff = { until: res.fastForwardUntil, restore: speed }; setSpeed(3600, false); }
    else if (res.suggestSpeed && speed < res.suggestSpeed && speed !== 0) setSpeed(res.suggestSpeed);
    if (res.tip) callout(res.tip, res.watch || a.watch[0]);
    persist();
    renderPanelNow();
    renderStatsIfOpen();
    return res;
  }

  function renderActions() {
    const bar = $('#actions');
    bar.innerHTML = '';
    A.actions.forEach(a => {
      const wrap = el('div', { class: 'act-wrap' });
      const b = el('button', { type: 'button', class: 'act', 'data-id': a.id, 'aria-haspopup': a.options ? 'menu' : null },
        icon(a.icon), a.label, a.options ? ' ▴' : '', a.key ? el('span', { class: 'kbd', 'aria-hidden': 'true' }, a.key.toUpperCase()) : null);
      b.addEventListener('click', () => {
        if (!a.options) { runAction(a); return; }
        if (openMenu && openMenu.parentNode === wrap) { closeMenu(); return; }
        closeMenu();
        const m = el('div', { class: 'menu', role: 'menu' }, a.options.map(o => el('button', { type: 'button', role: 'menuitem', onclick: () => { runAction(a, o.id); b.focus(); } }, el('span', {}, o.label), o.detail ? el('small', {}, o.detail) : null)));
        wrap.append(m);
        openMenu = m;
        m.querySelector('button').focus();
      });
      wrap.append(b);
      bar.append(wrap);
    });
    bar.append(el('span', { class: 'spacer' }));
    if (A.stories.length) bar.append(el('button', { type: 'button', class: 'act', onclick: () => startStory(A.stories[0]) }, icon('play'), A.stories[0].title));
    bar.append(el('button', { type: 'button', class: 'act', id: 'journalBtn', onclick: openJournal }, icon('book'), 'Journal', el('span', { class: 'kbd', 'aria-hidden': 'true' }, 'J')));
  }
  function updateBlocked() {
    A.actions.forEach(a => {
      const b = document.querySelector(`.act[data-id="${a.id}"]`);
      if (b) b.dataset.blocked = String(!!(a.blocked && a.blocked(s)));
    });
  }

  // ---------- Story ----------
  let story = null;
  function startStory(st) {
    story = { def: st, i: 0, ran: new Set() };
    showStep();
  }
  function showStep() {
    const box = $('#story');
    if (!story) { box.hidden = true; return; }
    const st = story.def, step = st.steps[story.i];
    if (step.node) go(step.node, { focusSpot: false });
    if (step.run && !story.ran.has(story.i)) {
      story.ran.add(story.i);
      const a = A.actions.find(x => x.id === step.run.action);
      if (a && !(a.blocked && a.blocked(s))) { runAction(a, step.run.option); $('#callout').hidden = true; }
    }
    box.innerHTML = '';
    const last = story.i === st.steps.length - 1;
    const next = el('button', { class: 'btn primary', type: 'button', onclick: () => { if (last) endStory(); else { story.i++; showStep(); } } }, last ? 'Finish' : 'Next →');
    box.append(
      el('div', { class: 'step' }, el('span', {}, `${st.title} · ${story.i + 1} of ${st.steps.length}`), el('button', { class: 'btn', type: 'button', onclick: endStory, 'aria-label': 'Close story' }, '✕')),
      el('p', {}, fill(step.say)),
      el('div', { class: 'row' }, story.i ? el('button', { class: 'btn', type: 'button', onclick: () => { story.i--; showStep(); } }, '← Back') : null, next));
    box.hidden = false;
    next.focus({ preventScroll: true });
  }
  function endStory() { story = null; $('#story').hidden = true; }

  // ---------- Journal ----------
  let journalDirty = false;
  function memoryBadges() {
    return Object.entries(s.immune || {}).filter(([, m]) => m.memory).map(([gid, m]) =>
      el('span', { class: 'badge' }, `Remembers ${A.germs[gid] ? A.germs[gid].name.toLowerCase() : gid} (${m.source === 'vaccine' ? 'from a vaccine' : 'from an infection'}, ${A.clock(m.at || 0).text.split(' · ')[0]})`));
  }
  function openJournal() {
    const d = $('#journal');
    renderJournal();
    if (!d.open) d.showModal();
  }
  function renderStatsIfOpen() { if ($('#journal').open) renderJournal(); }
  function renderJournal() {
    const d = $('#journal');
    journalDirty = false;
    d.innerHTML = '';
    const badges = memoryBadges();
    d.append(
      el('div', { class: 'head' }, el('div', {}, el('h2', { id: 'journalTitle' }, `${body.name}'s journal`), el('p', { class: 'note' }, `Time inside ${body.name} only moves while this page is open.`)),
        el('form', { method: 'dialog' }, el('button', { class: 'btn', type: 'submit' }, 'Close'))),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', {}, A.clock(s.t).text.split(' · ')[0]), el('span', {}, 'Body time')),
        el('div', { class: 'stat' }, el('b', {}, Math.round(s.beats).toLocaleString()), el('span', {}, 'Heartbeats counted')),
        el('div', { class: 'stat' }, el('b', {}, String(s.mealsEaten || 0)), el('span', {}, 'Meals eaten'))),
      badges.length ? el('div', { class: 'badges' }, badges) : el('p', { class: 'note' }, 'No immune memories yet. Catch a germ or get a vaccine to make one.'),
      el('ul', { class: 'log' }, body.log.slice().reverse().map(e => el('li', {},
        el('time', {}, A.clock(e.t).text), el('span', {}, e.text),
        e.node && A.nodes[e.node] ? el('button', { class: 'btn', type: 'button', onclick: () => { d.close(); go(e.node); } }, 'See') : el('span', {})))),
      body.log.length ? null : el('p', { class: 'note' }, 'Nothing has happened yet.'));
  }

  // ---------- Who (bodies and settings) ----------
  const ageOptions = sel => { for (let a = 1; a <= 18; a++) sel.append(el('option', { value: a }, `${a} yr${a > 1 ? 's' : ''}`)); };
  function renderWho() {
    $('#whoName').textContent = body.name;
    $('#whoAge').textContent = `${body.age} yr${body.age > 1 ? 's' : ''}`;
    renderFirstRun();
  }
  function renderFirstRun() {
    $('#firstrun').hidden = !(body && body.example);
  }
  function openWho() {
    const d = $('#whoDialog');
    d.innerHTML = '';
    const name = el('input', { id: 'whoInName', type: 'text', value: body.name, maxlength: 24, autocomplete: 'off' });
    const age = el('select', { id: 'whoInAge' });
    ageOptions(age);
    age.value = String(body.age);
    const others = Object.values(bodies).filter(b => b.id !== body.id && !b.example);
    const newName = el('input', { id: 'whoNewName', type: 'text', placeholder: 'Name', maxlength: 24, autocomplete: 'off' });
    const newAge = el('select', { id: 'whoNewAge' });
    ageOptions(newAge);
    newAge.value = '8';
    const confirmBox = el('div', { class: 'form-row', hidden: true },
      el('span', {}, `Remove ${body.name} and everything that happened to them?`),
      el('button', { class: 'btn danger', type: 'button', onclick: removeBody }, 'Yes, remove'),
      el('button', { class: 'btn', type: 'button', onclick: () => { confirmBox.hidden = true; } }, 'Keep'));
    const seg = (key, opts) => el('span', { class: 'seg' }, opts.map(([v, lab]) => el('button', { type: 'button', 'aria-pressed': String(prefs[key] === v), onclick: ev => { prefs[key] = v; savePrefs(); ev.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === ev.currentTarget))); updateVitals(); } }, lab)));
    d.append(
      el('div', { class: 'head' }, el('h2', { id: 'whoTitle' }, 'Whose body?'), el('form', { method: 'dialog' }, el('button', { class: 'btn', type: 'submit' }, 'Close'))),
      el('div', { class: 'form-row' }, el('label', { for: 'whoInName' }, 'Name'), name),
      el('div', { class: 'form-row' }, el('label', { for: 'whoInAge' }, 'Age'), age,
        el('button', { class: 'btn primary', type: 'button', onclick: () => {
          const nmv = name.value.trim() || body.name;
          const wasExample = body.example;
          body.name = nmv; body.age = +age.value; body.example = false;
          if (wasExample) logFn(`${nmv}'s body was named.`, { node: 'body' });
          persist(); renderWho(); renderPanel(); d.close();
        } }, 'Save')),
      body.example ? null : el('div', { class: 'form-row' }, el('button', { class: 'btn danger', type: 'button', onclick: () => { confirmBox.hidden = false; } }, `Remove ${body.name}`)), confirmBox,
      others.length ? el('h3', { class: 'section-title' }, 'Switch to') : null,
      others.length ? el('div', { class: 'bodylist' }, others.map(b => el('button', { class: 'btn', type: 'button', onclick: () => { persist(); useBody(b); persist(b); d.close(); } }, `${b.name}, ${b.age}`))) : null,
      el('h3', { class: 'section-title' }, 'Add another child'),
      el('div', { class: 'form-row' }, newName, newAge, el('button', { class: 'btn', type: 'button', onclick: () => {
        const nmv = newName.value.trim();
        if (!nmv) { newName.focus(); return; }
        createReal(nmv, +newAge.value); d.close();
      } }, 'Add')),
      el('h3', { class: 'section-title' }, 'Display'),
      el('div', { class: 'form-row' }, el('label', {}, 'Temperature'), seg('temp', [['C', '°C'], ['F', '°F']])),
      el('div', { class: 'form-row' }, el('label', {}, 'Blood sugar'), seg('glucose', [['mmol', 'mmol/L'], ['mg', 'mg/dL']])),
      el('p', { class: 'note' }, store.mode === 'cloud' ? 'Bodies are saved to your Claude account, so they follow you to other devices.' : 'Bodies are saved in this browser only.'),
      el('p', { class: 'note' }, 'The simulator uses typical values for a healthy child. Real children vary a lot. It is for learning, not medical advice.'));
    d.showModal();
  }
  function createReal(name, age) {
    if (body && body.example) delete bodies[body.id];
    const b = newBody(name, age, false);
    b.log.push({ t: b.sim.t, text: `${name}'s body joined Inside Me, age ${age}.`, node: 'body' });
    bodies[b.id] = b;
    useBody(b);
    persist(b);
    go('body', { force: true });
  }
  function removeBody() {
    const id = body.id;
    delete bodies[id];
    if (store.db && store.uid && !store.refused) store.db.doc(`data/users/${store.uid}/bodies/${id}`).delete().catch(() => {});
    const rest = Object.values(bodies).filter(b => !b.example);
    const next = rest[0] || exampleBody();
    bodies[next.id] = next;
    useBody(next);
    writeLS(LS_KEY, { bodies: Object.fromEntries(rest.map(b => [b.id, b])), current: rest[0] ? rest[0].id : null });
    $('#whoDialog').close();
  }

  // ---------- Keyboard and TV remote ----------
  function focusables() {
    const scope = document.querySelector('dialog[open]') || document;
    return [...scope.querySelectorAll('button, input, select, summary, [href]')].filter(e => !e.disabled && e.offsetParent !== null && !e.closest('[hidden]'));
  }
  function spatial(dir) {
    const els = focusables();
    const cur = document.activeElement;
    if (!cur || cur === document.body || !els.includes(cur)) { (spotsEl.querySelector('.spot') || els[0]).focus(); return; }
    const r0 = cur.getBoundingClientRect();
    const c0 = [r0.left + r0.width / 2, r0.top + r0.height / 2];
    let best = null, bestD = Infinity;
    els.forEach(e => {
      if (e === cur) return;
      const r = e.getBoundingClientRect();
      const c = [r.left + r.width / 2, r.top + r.height / 2];
      const dx = c[0] - c0[0], dy = c[1] - c0[1];
      const main = dir === 'ArrowRight' ? dx : dir === 'ArrowLeft' ? -dx : dir === 'ArrowDown' ? dy : -dy;
      const side = dir === 'ArrowRight' || dir === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
      if (main <= 4) return;
      const d = main + side * 2.2;
      if (d < bestD) { bestD = d; best = e; }
    });
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  document.addEventListener('keydown', ev => {
    const t = ev.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (ev.key === 'Escape') {
      if (openMenu) { closeMenu(); ev.preventDefault(); return; }
      if (document.querySelector('dialog[open]')) return;
      if (story) { endStory(); return; }
      if (!typing) zoomOut();
      return;
    }
    if (typing || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === 'Backspace') { ev.preventDefault(); zoomOut(); return; }
    if (ev.key.startsWith('Arrow')) { ev.preventDefault(); spatial(ev.key); return; }
    if (document.querySelector('dialog[open]')) return;
    const k = ev.key.toLowerCase();
    if (k === 'p') { setSpeed(speed ? 0 : 60); return; }
    if (k === 'j') { openJournal(); return; }
    const a = A.actions.find(x => x.key === k);
    if (a) { const b = document.querySelector(`.act[data-id="${a.id}"]`); if (b) { b.focus(); b.click(); } }
  });
  document.addEventListener('click', ev => { if (openMenu && !openMenu.parentNode.contains(ev.target)) closeMenu(); });

  // ---------- Main loop ----------
  let last = performance.now();
  let uiTick = 0, nowTick = 0, saveTick = 0;
  let lastSave = { t: 0, n: 0 };
  function renderPanelNow() { const nl = $('#nowLine'); if (nl) nl.textContent = nowText(A.nodes[current]); }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (speed > 0) {
      let simDt = dt * speed;
      if (ff && s.t + simDt >= ff.until) { simDt = Math.max(0, ff.until - s.t); setSpeed(ff.restore, false); ff = null; }
      A.sim.step(s, body, simDt, logFn);
    }
    if (layer) {
      const nm = norms();
      const liveDt = speed > 0 ? dt : 0;
      layer.ctxs.forEach((c, i) => {
        if (!c.L.live) return;
        try {
          c.L.live({ s, body, norms: nm, now, dt: liveDt, speed, root: layer.svg, q: sel => layer.svg.querySelector(sel), mem: c.mem });
        } catch (e) { if (!c.warned) { c.warned = true; console.error(`Live layer ${c.L.id} on ${layer.node.id} failed`, e); } }
      });
    }
    uiTick += dt; nowTick += dt; saveTick += dt;
    if (uiTick > 0.25) { uiTick = 0; updateVitals(); updateHappening(); updateBlocked(); if (journalDirty) renderStatsIfOpen(); }
    if (nowTick > 1) { nowTick = 0; renderPanelNow(); }
    if (saveTick > 30) { saveTick = 0; if (!body.example && (Math.abs(s.t - lastSave.t) > 60 || body.log.length !== lastSave.n)) persist(); }
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  function boot() {
    const saved = readLS(LS_KEY);
    if (saved && saved.bodies) Object.values(saved.bodies).forEach(b => { if (b && b.id) bodies[b.id] = hydrate(b); });
    let start = saved && saved.current && bodies[saved.current];
    if (!start) start = Object.values(bodies).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
    if (!start) { start = exampleBody(); bodies[start.id] = start; }
    useBody(start);

    const frAge = $('#frAge');
    ageOptions(frAge);
    frAge.value = '8';
    $('#frGo').addEventListener('click', () => {
      const nm = $('#frName').value.trim();
      if (!nm) { $('#frName').focus(); return; }
      createReal(nm, +frAge.value);
    });
    $('#frName').addEventListener('keydown', ev => { if (ev.key === 'Enter') $('#frGo').click(); });
    $('#whoBtn').addEventListener('click', openWho);
    $('#zoomOut').addEventListener('click', zoomOut);

    renderSpeed();
    renderVitals();
    renderActions();
    const hash = (location.hash || '').slice(1);
    stageReady = true;
    go(A.nodes[hash] ? hash : 'body', { force: true, instant: true });
    updateVitals();
    updateHappening();
    if ('ResizeObserver' in window) new ResizeObserver(placeSpots).observe(view);
    else window.addEventListener('resize', placeSpots);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
    window.addEventListener('pagehide', () => persist());
    requestAnimationFrame(frame);
    connectCloud();
  }

  boot();
})();
