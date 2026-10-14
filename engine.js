/*
 * Inside Me — engine.
 *
 * The engine holds no science of its own. Topic packs (packs/*.js) register:
 *   Atlas.system   a body system (digestion, circulation, ...) with its colour
 *   Atlas.node     one place you can zoom to: body, organ, tissue, cell, molecule
 *   Atlas.extend   add layers, hotspots or notes to a node another pack owns
 *   Atlas.process  a piece of the living simulation (stepped every few sim-seconds)
 *   Atlas.vital    a number shown in the vitals strip
 *   Atlas.action   something you can do to the body (run, eat, catch a germ...)
 *   Atlas.germ     a germ the immune model can fight
 *   Atlas.story    a guided tour through nodes and actions
 * See README.md for a worked example of adding a pack.
 */
(function () {
  'use strict';

  const nodes = Object.create(null);
  const systems = Object.create(null);
  const germs = Object.create(null);
  const actions = [];
  const processes = [];
  const vitals = [];
  const stories = [];
  const pending = Object.create(null);

  // Levels of zoom. New levels (atom, population, ecosystem...) can be pushed by a pack.
  const SCALES = [
    { id: 'body', label: 'Whole body' },
    { id: 'organ', label: 'Organ' },
    { id: 'tissue', label: 'Tissue' },
    { id: 'cell', label: 'Cell' },
    { id: 'molecule', label: 'Molecule' },
  ];

  function system(def) {
    systems[def.id] = Object.assign({ color: '--accent' }, def);
    return systems[def.id];
  }

  function node(def) {
    if (!def.id) throw new Error('Atlas.node needs an id');
    const n = Object.assign({
      parent: null, scale: 'organ', systems: [], species: 'human',
      numbers: [], words: [], whys: [], myths: [], notYet: null,
    }, def);
    ['numbers', 'words', 'whys', 'myths', 'systems'].forEach(k => { n[k] = (def[k] || []).slice(); });
    n.layers = [];
    n.hotspots = [];
    n.nowExtra = [];
    if (def.art) {
      n.viewBox = def.art.viewBox || '0 0 800 600';
      n.layers.push({ id: 'base', order: 0, draw: def.art.draw, live: def.art.live });
      n.hotspots = (def.art.hotspots || []).slice();
    }
    nodes[n.id] = n;
    (pending[n.id] || []).forEach(e => applyExt(n, e));
    delete pending[n.id];
    return n;
  }

  function extend(id, ext) {
    if (nodes[id]) applyExt(nodes[id], ext);
    else (pending[id] = pending[id] || []).push(ext);
  }

  function applyExt(n, e) {
    if (e.draw || e.live) {
      n.layers.push({ id: e.id || 'ext', order: e.order || 0, draw: e.draw, live: e.live });
      n.layers.sort((a, b) => a.order - b.order);
    }
    if (e.hotspots) n.hotspots.push(...e.hotspots);
    (e.systems || []).forEach(s => { if (!n.systems.includes(s)) n.systems.push(s); });
    ['numbers', 'words', 'whys', 'myths'].forEach(k => { if (e[k]) n[k].push(...e[k]); });
    if (e.now) n.nowExtra.push(e.now);
  }

  const action = def => { actions.push(Object.assign({ options: null, watch: [] }, def)); return def; };
  const process = def => { processes.push(Object.assign({ order: 50 }, def)); processes.sort((a, b) => a.order - b.order); return def; };
  const vital = def => { vitals.push(Object.assign({ order: 50 }, def)); vitals.sort((a, b) => a.order - b.order); return def; };
  const germ = def => { germs[def.id] = def; return def; };
  const story = def => { stories.push(def); return def; };

  const children = id => Object.values(nodes).filter(n => n.parent === id);
  function path(id) {
    const out = [];
    let n = nodes[id];
    while (n) { out.unshift(n); n = nodes[n.parent]; }
    return out;
  }

  // ---------- Simulation ----------
  // State is a plain JSON object so it can be saved and reloaded. Each process
  // fills in its own fields in init(); init must only set fields that are missing,
  // so old saves pick up fields added by newer packs.
  const SUBSTEP = 5; // seconds of body-time per integration step
  const sim = {
    create(body) {
      const s = { t: 7.5 * 3600 };
      sim.hydrate(s, body);
      return s;
    },
    hydrate(s, body) {
      const norms = Atlas.norms(body);
      processes.forEach(p => p.init && p.init(s, norms, body));
      return s;
    },
    step(s, body, dt, log) {
      const ctx = { body, norms: Atlas.norms(body), log, germs };
      let left = dt;
      while (left > 1e-6) {
        const h = Math.min(left, SUBSTEP);
        processes.forEach(p => p.step && p.step(s, h, ctx));
        s.t += h;
        left -= h;
      }
    },
    happening(s, body) {
      const norms = Atlas.norms(body);
      return processes.flatMap(p => (p.happening ? p.happening(s, norms, body) || [] : []));
    },
  };

  // Defaults a pack may replace: typical values by age for a healthy child.
  function norms(body) {
    return { weight: 25, hrRest: 85, hrMax: 200, brRest: 20, glucoseBase: 5 };
  }

  // ---------- Small helpers for packs ----------
  const setDefault = (o, k, v) => { if (o[k] === undefined) o[k] = v; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (v, target, dt, tau) => v + (target - v) * (1 - Math.exp(-dt / tau));

  function clock(t) {
    const day = Math.floor(t / 86400) + 1;
    const sec = t % 86400;
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    return { day, hh, mm, text: `Day ${day} · ${hh}:${mm}` };
  }

  const say = (str, body) => String(typeof str === 'function' ? str(body) : str || '').replace(/\{name\}/g, body ? body.name : 'you');

  // ---------- Drawing helpers (SVG strings) ----------
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Catmull-Rom spline through points, as a cubic Bezier path.
  function smooth(pts, closed) {
    const n = pts.length;
    if (n < 2) return '';
    const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return closed ? d + 'Z' : d;
  }

  // An organic closed shape around an ellipse.
  function blob(cx, cy, rx, ry, opt) {
    const o = Object.assign({ n: 10, wob: 0.08, seed: 7, rot: 0 }, opt);
    const r = rng(o.seed);
    const pts = [];
    for (let i = 0; i < o.n; i++) {
      const a = (i / o.n) * Math.PI * 2 + o.rot;
      const k = 1 + (r() * 2 - 1) * o.wob;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smooth(pts, true);
  }

  // Point and tangent along a polyline given as [[x,y],...], u in [0,1].
  function along(pts, u) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(l); total += l;
    }
    let d = ((u % 1) + 1) % 1 * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        const k = segs[i] ? d / segs[i] : 0;
        const a = pts[i], b = pts[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])];
      }
      d -= segs[i];
    }
    return [pts[0][0], pts[0][1], 0];
  }

  // Sample a smooth closed/open curve into a dense polyline (for `along`).
  function densify(pts, closed, per) {
    const out = [];
    const n = pts.length;
    const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < (per || 8); k++) {
        const t = k / (per || 8), t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(closed ? pts[0] : pts[n - 1]);
    return out;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Style shorthand: fill / stroke from theme tokens.
  const paint = (fill, stroke, sw, extra) =>
    `style="fill:${fill ? (fill.startsWith('--') ? `var(${fill})` : fill) : 'none'};stroke:${stroke ? (stroke.startsWith('--') ? `var(${stroke})` : stroke) : 'none'};stroke-width:${sw || 0}${extra ? ';' + extra : ''}"`;
  const label = (x, y, text, opt) => {
    const o = Object.assign({ size: 15, anchor: 'middle', color: '--ink-2', weight: 600 }, opt);
    return `<text x="${x}" y="${y}" text-anchor="${o.anchor}" class="svg-note" style="font-size:${o.size}px;fill:var(${o.color});font-weight:${o.weight}">${esc(text)}</text>`;
  };

  const Atlas = window.Atlas = {
    SCALES, nodes, systems, germs, actions, processes, vitals, stories,
    system, node, extend, action, process, vital, germ, story,
    children, path, sim, norms, clock, say,
    util: { setDefault, clamp, approach },
    draw: { rng, smooth, blob, along, densify, esc, paint, label },
  };
})();
