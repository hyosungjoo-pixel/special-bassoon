/*
 * Pack: digestion.
 * Mouth → stomach → small intestine → villus → enterocyte → SGLT1, plus the large intestine.
 * Simulation: meals empty from the stomach, sugars are absorbed and raise blood glucose,
 * insulin and the liver bring it back. Leftovers reach the large intestine and leave a day or so later.
 */
(function (A) {
  'use strict';
  const { setDefault, clamp, approach } = A.util;
  const { paint, label, smooth, blob, rng, along, densify } = A.draw;

  A.system({ id: 'digestion', name: 'Digestion', color: '--dig' });

  const stomachFill = (s, n) => clamp(s.meals.reduce((a, m) => a + m.inStomach * m.mass, 0) / (n.weight * 30), 0, 1);

  // ---------- Body overlay: digestive organs ----------
  const SI = [[452, 256], [436, 272], [372, 276], [370, 292], [430, 294], [432, 310], [372, 312], [374, 328], [428, 330], [412, 342]];
  const SI_D = densify(SI, false, 6);
  A.extend('body', {
    id: 'digestion', order: 20, systems: ['digestion'],
    draw() {
      const colon = 'M396,350 Q352,348 350,330 L350,268 Q352,258 362,258 L442,258 Q454,258 455,270 L456,330 Q456,350 412,352';
      return `
        <path d="M400,96 C402,140 404,180 430,212" ${paint(null, '--dig-tube', 6, 'stroke-linecap:round;opacity:.9')}/>
        <path d="${blob(378, 222, 40, 20, { seed: 4, wob: 0.06 })}" ${paint('--flesh-2', null, 0, 'opacity:.35')}/>
        <path d="${colon}" ${paint(null, '--dig-colon', 13, 'stroke-linecap:round;stroke-linejoin:round')}/>
        <path d="${smooth(SI, false)}" ${paint(null, '--dig-tube', 8, 'stroke-linecap:round')}/>
        <g id="si-dots"></g>
        <path id="stomach-shape" d="${smooth([[428, 208], [452, 204], [472, 216], [474, 238], [462, 254], [440, 258], [420, 250], [414, 232]], true)}" ${paint('--dig-tube', '--flesh-line', 2)}/>
        <ellipse id="stomach-fill" cx="446" cy="240" rx="22" ry="12" ${paint('--dig', null, 0, 'opacity:0')}/>
        <ellipse cx="400" cy="88" rx="11" ry="5" ${paint('--flesh-line', null)}/>`;
    },
    live(c) {
      const s = c.s;
      c.q('#stomach-fill').style.opacity = 0.15 + stomachFill(s, c.norms) * 0.85;
      const g = c.q('#si-dots');
      const k = Math.round(clamp(s.gutCarbs / 6, 0, 8));
      if (g.childElementCount !== k) g.innerHTML = Array.from({ length: k }, () => `<circle r="3" ${paint('--dig', null)}/>`).join('');
      c.mem.ph = (c.mem.ph || 0) + c.dt * 0.08;
      [...g.children].forEach((el, i) => { const p = along(SI_D, c.mem.ph + i / k); el.setAttribute('cx', p[0]); el.setAttribute('cy', p[1]); });
    },
    hotspots: [
      { to: 'mouth', at: [400, 88], label: 'Mouth', side: 'left', anchor: [190, 80] },
      { to: 'smallIntestine', at: [400, 300], label: 'Small intestine', side: 'left', anchor: [190, 296] },
      { to: 'largeIntestine', at: [352, 330], label: 'Large intestine', side: 'left', anchor: [190, 352] },
      { to: 'stomach', at: [446, 232], label: 'Stomach', side: 'right', anchor: [610, 236] },
    ],
  });

  // ---------- Mouth ----------
  A.node({
    id: 'mouth', parent: 'body', scale: 'organ', name: 'Mouth', systems: ['digestion'],
    size: () => 'About 5 cm wide',
    kid: 'Digestion starts here. Teeth cut and crush, and spit (saliva) starts turning starch into sugar before {name} even swallows.',
    adult: `<p>Chewing breaks food into a soft lump with more surface for enzymes to work on. Saliva wets it and contains <strong>amylase</strong>, an enzyme that starts splitting starch into a sugar called maltose. Chew plain bread for a minute and it starts to taste sweeter.</p>
      <p>Swallowing starts on purpose, then becomes a reflex: a flap (the epiglottis) covers the windpipe, and rings of muscle squeeze food down the oesophagus. That squeezing is called <strong>peristalsis</strong>, and it works without gravity, which is how astronauts can eat.</p>`,
    numbers: [
      { value: '0.5–1.5 L', what: 'saliva made per day', who: 'adult' },
      { value: '20 → 32', what: 'baby teeth, then adult teeth (including wisdom teeth)', who: 'any' },
      { value: '≈ 25 cm', what: 'length of the oesophagus; food takes a few seconds to reach the stomach', who: 'adult' },
    ],
    words: [['Saliva', 'Spit. Mostly water, plus enzymes and mucus.'], ['Amylase', 'An enzyme that cuts starch into smaller sugars.'], ['Oesophagus', 'The food pipe from throat to stomach. In the US it is spelled esophagus.'], ['Peristalsis', 'Waves of muscle squeezing that push food along.']],
    simplified: 'Saliva amylase only does a small part of starch digestion. Most of it happens later, in the small intestine, using amylase from the pancreas.',
    whys: [
      { q: 'Why does bread taste sweet if I chew it a long time?', a: 'Amylase in saliva cuts starch, which has no taste, into maltose, which tastes a little sweet.' },
      { q: 'Why don\'t I choke every time I swallow?', a: 'The epiglottis folds down over the windpipe while you swallow. Talking or laughing with food in your mouth can interrupt that reflex.' },
    ],
    notYet: 'Teeth and salivary glands up close',
    art: {
      draw() {
        const teeth = (y, dir) => Array.from({ length: 8 }, (_, i) => {
          const x = 262 + i * 36.5, dy = Math.abs(i - 3.5) * 5 * dir;
          return `<rect x="${x}" y="${y + dy - (dir < 0 ? 0 : 40)}" width="31" height="40" rx="9" ${paint('--tooth', '--body-line', 1.5)}/>`;
        }).join('');
        return `
          <path d="${blob(400, 270, 260, 175, { seed: 3, wob: 0.03, n: 14 })}" ${paint('--flesh-2', '--flesh-line', 3)}/>
          <ellipse cx="400" cy="275" rx="205" ry="128" ${paint('--mouth', null)}/>
          <circle cx="400" cy="250" r="40" ${paint('--throat', null)}/>
          <path d="${blob(400, 345, 150, 70, { seed: 9, wob: 0.05 })}" ${paint('--flesh', '--flesh-line', 2)}/>
          <path d="M400,300 L400,370" ${paint(null, '--flesh-line', 2, 'opacity:.5')}/>
          ${teeth(160, 1)}${teeth(392, -1)}
          <g id="saliva">${[[215, 300], [585, 300], [240, 360], [560, 360]].map(([x, y]) => `<path d="M${x},${y - 12} q8,12 0,18 q-8,-6 0,-18z" ${paint('--water', null)}/>`).join('')}</g>
          <g id="crumbs"></g>
          ${label(130, 100, 'Teeth cut and grind', { anchor: 'start' })}
          ${label(400, 485, 'Tongue pushes food to the back', {})}
          ${label(130, 420, 'Saliva starts on starch', { anchor: 'start' })}`;
      },
      live(c) {
        const s = c.s;
        const recent = s.t - s.lastMealAt < 300;
        const g = c.q('#crumbs');
        if (recent && g.childElementCount === 0) g.innerHTML = Array.from({ length: 10 }, (_, i) => `<circle r="${5 + (i % 3) * 2}" ${paint('--dig', null)}/>`).join('');
        if (!recent && g.childElementCount) g.innerHTML = '';
        c.mem.ph = (c.mem.ph || 0) + c.dt * 0.6;
        [...g.children].forEach((el, i) => {
          const u = (c.mem.ph + i / 10) % 1, a = i * 2.4;
          el.setAttribute('cx', 400 + Math.cos(a) * 140 * (1 - u));
          el.setAttribute('cy', 250 + Math.sin(a) * 90 * (1 - u));
          el.setAttribute('opacity', 1 - u * 0.8);
        });
        c.q('#saliva').style.opacity = 0.55 + 0.45 * Math.sin(c.now / 700);
      },
      hotspots: [{ to: 'stomach', at: [400, 250], label: 'Swallow: down to the stomach', side: 'right', anchor: [640, 205] }],
    },
    now: (s, body) => s.t - s.lastMealAt < 300 ? `${body.name} is chewing and swallowing.` : 'Quiet. Saliva keeps flowing slowly even between meals.',
  });

  // ---------- Stomach ----------
  const STOMACH = [[330, 140], [400, 108], [470, 138], [502, 210], [512, 300], [560, 362], [620, 372], [648, 338], [672, 366], [642, 438], [560, 472], [450, 462], [368, 410], [318, 320], [302, 220]];
  A.node({
    id: 'stomach', parent: 'body', scale: 'organ', name: 'Stomach', systems: ['digestion', 'immunity'],
    size: () => 'About 25 cm long in an adult, smaller in a child',
    kid: 'The stomach is a stretchy muscle bag. It squeezes food and mixes it with strong acid until it turns into a thick soup, then lets it out a little squirt at a time.',
    adult: `<p>The stomach stores a meal and mixes it with gastric juice. The <strong>hydrochloric acid</strong> (pH about 1.5–3.5) unfolds proteins so the enzyme <strong>pepsin</strong> can cut them, and it kills many of the microbes that arrive with food. That makes the stomach part of the immune system's front line.</p>
      <p>Almost no nutrients are absorbed here. The stomach protects itself with a thick layer of mucus and bicarbonate, and its lining cells are replaced every few days. The soupy result, <strong>chyme</strong>, leaves through a ring of muscle (the pyloric sphincter) in small squirts. For a mixed meal, about half has usually left after 1–2 hours.</p>`,
    numbers: [
      { value: 'pH 1.5–3.5', what: 'acidity of stomach juice; lemon juice is about pH 2', who: 'any' },
      { value: '≈ 1–1.5 L', what: 'how much an adult stomach can comfortably stretch to hold', who: 'adult' },
      { value: '1–2 h', what: 'for about half of a solid meal to leave the stomach; it varies a lot with the food', who: 'any' },
    ],
    words: [['Chyme', 'The soupy mix of food and stomach juice.'], ['Pepsin', 'An enzyme that starts cutting proteins.'], ['Sphincter', 'A ring of muscle that works like a drawstring.']],
    myths: [{ myth: 'Your stomach is behind your belly button.', truth: 'It sits higher, mostly under the lower ribs on the left side. Behind the belly button is mainly small intestine.' }],
    simplified: 'We show emptying as a smooth curve. A real stomach grinds solids until pieces are about 1–2 mm before letting them through, so liquids leave first.',
    whys: [
      { q: 'Why doesn\'t the acid digest the stomach?', a: 'A thick layer of mucus with bicarbonate keeps the acid off the lining, and lining cells are replaced every few days. When that protection fails, an ulcer can form.' },
      { q: 'Why does my tummy rumble?', a: 'Muscles are squeezing gas and liquid along. When the stomach is empty, a cleaning wave sweeps through roughly every 1.5–2 hours, and you hear it more because nothing muffles it.' },
    ],
    notYet: 'Stomach lining and acid-making cells',
    art: {
      draw() {
        const shape = smooth(STOMACH, true);
        const r = rng(5);
        const rugae = Array.from({ length: 7 }, (_, i) => {
          const y = 190 + i * 38;
          return `<path d="M${330 + r() * 20},${y} q30,-16 60,0 t60,0 t60,0" ${paint(null, '--flesh-line', 3, 'opacity:.35;stroke-linecap:round')}/>`;
        }).join('');
        return `
          <defs><clipPath id="stclip"><path d="${shape}"/></clipPath></defs>
          <path d="M330,10 C335,60 350,100 368,128" ${paint(null, '--flesh-2', 46, 'stroke-linecap:round')}/>
          <path d="M650,352 C690,330 730,320 790,330" ${paint(null, '--flesh-2', 40, 'stroke-linecap:round')}/>
          <path d="${shape}" ${paint('--flesh', '--flesh-line', 4)}/>
          <g clip-path="url(#stclip)">
            ${rugae}
            <path id="chyme" ${paint('--dig', null, 0, 'opacity:.75')}/>
            <g id="bubbles"></g>
          </g>
          <path d="${shape}" ${paint(null, '--flesh-line', 4)}/>
          ${label(240, 40, 'From the oesophagus', { anchor: 'start' })}
          ${label(540, 200, 'Acid: pH 1.5–3.5', { anchor: 'start', color: '--dig' })}
          <text id="st-empty" x="470" y="300" text-anchor="middle" class="svg-note" style="font-size:18px;fill:var(--ink-2);font-weight:600">Empty and resting</text>`;
      },
      live(c) {
        const fill = stomachFill(c.s, c.norms);
        c.mem.ph = (c.mem.ph || 0) + c.dt * (fill > 0.02 ? 2.2 : 0.4);
        const top = 470 - fill * 330;
        let d = `M280,${top}`;
        for (let x = 280; x <= 700; x += 20) d += ` L${x},${top + Math.sin(x / 40 + c.mem.ph) * 9 * Math.min(1, fill * 4)}`;
        d += ' L700,500 L280,500 Z';
        c.q('#chyme').setAttribute('d', fill > 0.01 ? d : '');
        c.q('#st-empty').style.opacity = fill > 0.02 ? 0 : 1;
        const b = c.q('#bubbles');
        if (!b.childElementCount) b.innerHTML = Array.from({ length: 12 }, () => `<circle r="4" ${paint(null, '--ink', 1.5, 'opacity:.5')}/>`).join('');
        [...b.children].forEach((el, i) => {
          const u = (c.mem.ph * 0.15 + i / 12) % 1;
          el.setAttribute('cx', 360 + ((i * 53) % 280));
          el.setAttribute('cy', 460 - u * Math.max(20, fill * 330));
          el.style.opacity = fill > 0.02 ? 0.6 * (1 - u) : 0;
        });
      },
      hotspots: [
        { to: 'smallIntestine', at: [662, 352], label: 'Out to the small intestine', side: 'right', anchor: [600, 520] },
        { to: 'mouth', at: [340, 50], label: 'Back up to the mouth', side: 'right', anchor: [450, 60] },
      ],
    },
    now(s, body, n) {
      const f = stomachFill(s, n);
      if (f < 0.02) return s.t - s.lastMealAt > 4.5 * 3600 ? `Empty. ${body.name} is probably getting hungry.` : 'Empty and resting.';
      return `About ${Math.round(f * 100)}% full, churning food into chyme.`;
    },
  });

  // ---------- Small intestine ----------
  const COIL = [[60, 90], [470, 90], [480, 150], [470, 180], [80, 180], [70, 240], [80, 270], [470, 270], [480, 330], [470, 360], [80, 360], [70, 420], [80, 450], [480, 450], [520, 520]];
  const COIL_D = densify(COIL, false, 10);
  A.node({
    id: 'smallIntestine', parent: 'body', scale: 'organ', name: 'Small intestine', systems: ['digestion'],
    size: () => '3–5 m long in an adult, about 2.5 cm wide',
    kid: 'A long, folded tube where food finally gets inside {name}. The food is broken into pieces so small they slip through the wall and into the blood.',
    adult: `<p>The first part, the duodenum, receives <strong>bile</strong> from the liver (it breaks fat into tiny droplets, like washing-up liquid) and juice from the pancreas full of enzymes that cut starch, proteins and fats. The rest of the tube, the jejunum and ileum, absorbs most of the nutrients you get from food.</p>
      <p>Its inner surface is folded, the folds are covered in tiny fingers called <strong>villi</strong>, and every cell on the villi is fuzzy with <strong>microvilli</strong>. Each level multiplies the surface. Food usually takes 2–6 hours to pass through.</p>`,
    numbers: [
      { value: '3–5 m', what: 'length in a living adult. It measures 6–7 m after death, when its muscles relax', who: 'adult' },
      { value: '≈ 30 m²', what: 'inner surface of the whole gut, about half a badminton court', who: 'adult', src: 'Helander & Fändriks, Scand J Gastroenterol 2014' },
      { value: '2–6 h', what: 'time for food to pass through', who: 'any' },
    ],
    words: [['Bile', 'Greenish juice from the liver that breaks fat into small droplets.'], ['Villi', 'Tiny finger-like bumps lining the small intestine. One is a villus.'], ['Absorb', 'To take something in through a surface.']],
    myths: [{ myth: 'The gut\'s surface is as big as a tennis court.', truth: 'That old figure counted surfaces too generously. A 2014 measurement puts the whole gut lining at about 30 m², roughly half a badminton court. Still huge for something inside you.' }],
    simplified: 'The drawing is coiled neatly. A real small intestine is loosely packed and moves around as it squeezes.',
    whys: [
      { q: 'Why is it called "small" if it\'s the longest part?', a: '"Small" is about its width: about 2.5 cm across, compared with about 6 cm for the large intestine.' },
      { q: 'Why does food go to the liver first?', a: 'Blood from the intestine flows through the liver before the rest of the body. The liver stores extra sugar, deals with some toxins, and smooths out the flood after a meal.' },
    ],
    art: {
      draw() {
        const d = smooth(COIL, false);
        return `
          <path d="${d}" ${paint(null, '--flesh-line', 50, 'stroke-linecap:round;stroke-linejoin:round')}/>
          <path d="${d}" ${paint(null, '--flesh', 42, 'stroke-linecap:round;stroke-linejoin:round')}/>
          <path d="${d}" ${paint(null, '--flesh-2', 4, 'stroke-dasharray:3 14;stroke-linecap:round;opacity:.7')}/>
          <g id="food"></g>
          <path d="M480,270 L560,300" ${paint(null, '--ink-2', 2, 'stroke-dasharray:4 6')}/>
          <circle cx="660" cy="300" r="115" ${paint('--lumen', '--ink-2', 3)}/>
          ${Array.from({ length: 7 }, (_, i) => {
            const x = 580 + i * 27;
            return `<path d="M${x - 10},400 L${x - 10},${330 - (i % 2) * 18} a10,10 0 0 1 20,0 L${x + 10},400 Z" ${paint('--flesh', '--flesh-line', 2)}/>`;
          }).join('')}
          <path d="M548,400 L772,400 L772,412 L548,412 Z" ${paint('--flesh-2', null)}/>
          ${label(660, 168, 'Zoomed in: the wall', {})}
          ${label(60, 52, 'From the stomach', { anchor: 'start' })}
          ${label(520, 575, 'On to the large intestine', { anchor: 'middle' })}`;
      },
      live(c) {
        const g = c.q('#food');
        const k = Math.round(clamp(c.s.gutCarbs / 2, 0, 24));
        if (g.childElementCount !== k) g.innerHTML = Array.from({ length: k }, () => `<circle r="7" ${paint('--dig', null)}/>`).join('');
        c.mem.ph = (c.mem.ph || 0) + c.dt * 0.02;
        [...g.children].forEach((el, i) => { const p = along(COIL_D, c.mem.ph + i / k); el.setAttribute('cx', p[0]); el.setAttribute('cy', p[1]); });
      },
      hotspots: [{ to: 'villus', at: [660, 340], label: 'Villi', side: 'right', anchor: [660, 470] }],
    },
    now: s => s.gutCarbs > 1 ? `Digesting about ${Math.round(s.gutCarbs)} g of carbohydrate and absorbing it right now.` : 'Mostly empty. Cleaning waves sweep through every couple of hours.',
  });

  // ---------- Villus ----------
  const fingerPath = (cx, w, top, base) => `M${cx - w / 2},${base} L${cx - w / 2},${top + w / 2} A${w / 2},${w / 2} 0 0 1 ${cx + w / 2},${top + w / 2} L${cx + w / 2},${base} Z`;
  const CAP_L = [[350, 540], [345, 300], [352, 170], [400, 128], [448, 170], [455, 300], [450, 540]];
  const CAP_D = densify(CAP_L, false, 8);
  A.node({
    id: 'villus', parent: 'smallIntestine', scale: 'tissue', name: 'Villus', systems: ['digestion', 'circulation'],
    size: () => 'About 0.5–1 mm tall',
    kid: 'Zoom in on the wall and it is covered in soft little fingers called villi, like the loops on a towel. Each one has tiny blood vessels inside, waiting to pick up food.',
    adult: `<p>Each villus is covered by a single layer of cells, mostly <strong>enterocytes</strong> (absorbing cells) plus goblet cells that make mucus. Inside is a net of capillaries and one lymph vessel, the <strong>lacteal</strong>.</p>
      <p>Sugars and amino acids cross the lining into the capillaries and travel first to the liver (through the hepatic portal vein). Fats are packed into droplets that go into the lacteal and reach the blood later, by way of the lymph. In the pits between villi, stem cells divide all the time, and the whole lining is replaced every few days.</p>`,
    numbers: [
      { value: '0.5–1 mm', what: 'height of one villus', who: 'adult' },
      { value: '3–5 days', what: 'lifetime of a lining cell before it is shed from the tip', who: 'any' },
      { value: '1 cell', what: 'thickness of the layer between food and blood', who: 'any' },
    ],
    words: [['Capillary', 'The thinnest blood vessel. Its wall is one cell thick.'], ['Lacteal', 'A lymph vessel inside each villus that takes up fat.'], ['Stem cell', 'A cell that can keep dividing to make new cells of a tissue.']],
    simplified: 'We show five villi. Your small intestine has millions, packed side by side like the pile of a carpet.',
    whys: [
      { q: 'Why does the lining get replaced so often?', a: 'It lives next to digestive enzymes, acid from the stomach and lots of bacteria. Replacing it every few days keeps it working and gets rid of damaged cells.' },
    ],
    art: {
      draw() {
        const r = rng(11);
        const fingers = [[140, 110, 190], [270, 120, 150], [660, 120, 170], [770, 100, 230]].map(([x, w, top]) =>
          `<path d="${fingerPath(x, w, top, 560)}" ${paint('--flesh', '--flesh-2', 12, 'stroke-dasharray:16 3')}/>`).join('');
        return `
          <rect x="0" y="0" width="800" height="600" ${paint('--lumen', null)}/>
          ${fingers}
          <path d="${fingerPath(400, 190, 80, 560)}" ${paint('--flesh', '--flesh-2', 16, 'stroke-dasharray:22 3')}/>
          <path d="M400,560 L400,180" ${paint(null, '--lacteal', 22, 'stroke-linecap:round')}/>
          <path d="${smooth(CAP_L, false)}" ${paint(null, 'url(#capgrad)', 9, 'stroke-linecap:round')}/>
          ${[220, 300, 380, 460].map(y => `<path d="M${348},${y} C380,${y + 18} 420,${y - 18} ${452},${y}" ${paint(null, '--blood-mid', 4)}/>`).join('')}
          <defs><linearGradient id="capgrad" x1="0" x2="1" y1="0" y2="0"><stop offset="0" style="stop-color:var(--blood-o2)"/><stop offset="1" style="stop-color:var(--blood-low)"/></linearGradient></defs>
          <rect x="0" y="560" width="800" height="40" ${paint('--flesh-2', null)}/>
          ${[205, 335, 530].map(x => `<path d="M${x - 14},560 q14,30 28,0" ${paint('--lumen', '--flesh-line', 2)}/>`).join('')}
          <g id="glu"></g>
          ${label(570, 40, 'Digested food (sugar shown as dots)', { anchor: 'middle', color: '--dig' })}
          ${label(400, 592, 'Pits between villi: stem cells make new lining cells', { size: 13, color: '--ink' })}
          ${label(400, 360, 'lacteal', { size: 13, color: '--ink' })}`;
      },
      live(c) {
        const s = c.s;
        const g = c.q('#glu');
        const k = Math.round(clamp(s.absorb * 40, 0, 22));
        if (g.childElementCount !== k) g.innerHTML = Array.from({ length: k }, () => `<circle r="6" ${paint('--dig', '--ink', 1)}/>`).join('');
        c.mem.ph = (c.mem.ph || 0) + c.dt * 0.12;
        [...g.children].forEach((el, i) => {
          const u = (c.mem.ph + i / k) % 1;
          let x, y;
          const side = i % 2 ? 1 : -1;
          if (u < 0.35) { const v = u / 0.35; x = 400 + side * (180 - v * 85); y = 60 + v * 160 + (i * 37) % 120; }
          else { const p = along(side < 0 ? CAP_D : CAP_D.slice().reverse(), 0.25 + (u - 0.35) / 0.65 * 0.75); x = p[0]; y = p[1]; }
          el.setAttribute('cx', x); el.setAttribute('cy', y);
        });
      },
      hotspots: [
        { to: 'enterocyte', at: [306, 230], label: 'One lining cell', side: 'left', anchor: [210, 110] },
        { to: 'blood', at: [452, 520], label: 'Into the blood', side: 'right', anchor: [560, 470] },
      ],
    },
    now: s => s.absorb > 0.05 ? `Absorbing about ${(s.absorb).toFixed(2)} g of sugar a minute into the blood.` : 'Nothing much to absorb right now.',
  });

  // ---------- Enterocyte ----------
  A.node({
    id: 'enterocyte', parent: 'villus', scale: 'cell', name: 'Enterocyte', systems: ['digestion'],
    size: () => 'About 20–30 µm tall',
    kid: 'This is one single cell from the lining. Its top is fuzzy with even tinier fingers. It grabs sugar from the food side and passes it out the other side into the blood.',
    adult: `<p>Enterocytes have two different faces. The top (apical) face has a <strong>brush border</strong> of microvilli carrying enzymes that finish digestion, such as sucrase and lactase. Neighbouring cells are sealed together near the top by <strong>tight junctions</strong>, so most things have to go through a cell rather than between cells.</p>
      <p>Glucose enters through a transporter called <strong>SGLT1</strong>, which needs sodium to come in with it. It leaves at the bottom through another one, <strong>GLUT2</strong>. A pump on the bottom face pushes sodium back out and keeps sodium low inside, which keeps SGLT1 running. Each enterocyte lives only a few days.</p>`,
    numbers: [
      { value: '≈ 1 µm', what: 'height of one microvillus', who: 'any' },
      { value: 'thousands', what: 'microvilli on one cell; published estimates vary', who: 'any' },
      { value: '3–5 days', what: 'from birth in a pit to being shed at a villus tip', who: 'any' },
    ],
    words: [['Brush border', 'The fuzzy top of the cell, made of microvilli.'], ['Tight junction', 'A seal between neighbouring cells.'], ['Lactase', 'The enzyme that digests milk sugar (lactose).']],
    myths: [{ myth: 'Being lactose intolerant is unusual.', truth: 'Most adults in the world make much less lactase than they did as babies. Keeping it into adulthood is the less common trait, mainly in people with ancestry from places with a long history of dairy farming.' }],
    simplified: 'One cell, cut open and enlarged. The nucleus, mitochondria and transporters are drawn far bigger than scale so you can see them.',
    whys: [{ q: 'Why do some people get tummy aches from milk?', a: 'Without enough lactase, milk sugar passes on to the large intestine, where bacteria ferment it and make gas.' }],
    art: {
      draw() {
        const micro = x0 => Array.from({ length: 24 }, (_, i) => `<path d="M${x0 + 6 + i * 8},152 L${x0 + 6 + i * 8},118" ${paint(null, '--flesh-2', 4, 'stroke-linecap:round')}/>`).join('');
        return `
          <rect x="0" y="0" width="800" height="150" ${paint('--lumen', null)}/>
          <rect x="300" y="150" width="200" height="370" rx="18" ${paint('--flesh', '--flesh-line', 3)}/>
          <rect x="80" y="150" width="208" height="370" rx="18" ${paint('--flesh', '--flesh-line', 3, 'opacity:.6')}/>
          <rect x="512" y="150" width="208" height="370" rx="18" ${paint('--flesh', '--flesh-line', 3, 'opacity:.6')}/>
          ${micro(300)}
          <rect x="288" y="152" width="12" height="20" ${paint('--ink-2', null)}/><rect x="500" y="152" width="12" height="20" ${paint('--ink-2', null)}/>
          <ellipse cx="400" cy="410" rx="52" ry="40" ${paint('--nucleus', null, 0, 'opacity:.85')}/>
          ${[[340, 260], [455, 300], [350, 340], [450, 220]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="10" transform="rotate(${i * 40} ${x} ${y})" ${paint('--mito', '--flesh-line', 1.5)}/>`).join('')}
          <rect x="384" y="140" width="32" height="22" rx="6" ${paint('--dig', '--ink', 2)}/>
          <rect x="384" y="510" width="32" height="20" rx="6" ${paint('--imm', '--ink', 2)}/>
          <rect x="0" y="540" width="800" height="50" rx="24" ${paint('--blood-o2', null)}/>
          <g id="eg"></g>
          ${label(150, 60, 'Gut side: digested food', { anchor: 'start', color: '--dig' })}
          ${label(400, 470, 'nucleus', { size: 14, color: '--ink' })}
          ${label(232, 186, 'tight junction', { size: 13, anchor: 'end' })}
          ${label(560, 528, 'GLUT2: exit door', { size: 14, anchor: 'start', color: '--imm' })}
          ${label(400, 572, 'Capillary: blood', { size: 15, color: '--on-blood' })}`;
      },
      live(c) {
        const g = c.q('#eg');
        const k = Math.round(clamp(c.s.absorb * 30, 0, 10));
        if (g.childElementCount !== k) g.innerHTML = Array.from({ length: k }, () => `<circle r="7" ${paint('--dig', '--ink', 1)}/>`).join('');
        c.mem.ph = (c.mem.ph || 0) + c.dt * 0.1;
        const P = [[250, 70], [400, 110], [400, 150], [420, 260], [380, 360], [400, 520], [520, 565], [800, 565]];
        [...g.children].forEach((el, i) => { const p = along(P, c.mem.ph + i / k); el.setAttribute('cx', p[0]); el.setAttribute('cy', p[1]); });
      },
      hotspots: [{ to: 'sglt1', at: [400, 150], label: 'SGLT1: the entry door', side: 'right', anchor: [560, 90] }],
    },
    now: s => s.absorb > 0.05 ? 'Busy: sugar is streaming in at the top and out at the bottom.' : 'Waiting for the next meal. Still pumping sodium out.',
  });

  // ---------- SGLT1 ----------
  A.node({
    id: 'sglt1', parent: 'enterocyte', scale: 'molecule', name: 'SGLT1 transporter', systems: ['digestion'],
    size: () => 'A few nanometres across',
    kid: 'A door made of protein. It only lets a sugar through when two bits of salt (sodium) come in with it.',
    adult: `<p>SGLT1 (sodium–glucose linked transporter 1) carries <strong>two sodium ions with each glucose</strong> (or galactose) across the membrane. Sodium is much more concentrated outside the cell than inside, so sodium "wants" to flow in, and the protein uses that flow to drag glucose in too, even when there is already more glucose inside. Fructose, the sugar in fruit, uses a different door, GLUT5.</p>
      <p>This has saved millions of lives. In diarrhoea, the gut loses water and salt. <strong>Oral rehydration solution</strong>, clean water with a little sugar and salt, works because glucose and sodium are pulled in together through SGLT1, and water follows them.</p>`,
    numbers: [
      { value: '2 Na⁺ : 1 glucose', what: 'what each cycle moves', who: 'any' },
      { value: '≈ 1 nm', what: 'size of one glucose molecule (C₆H₁₂O₆)', who: 'any' },
      { value: '≈ 5 nm', what: 'thickness of the cell membrane it sits in', who: 'any' },
    ],
    words: [['Membrane', 'The thin, oily skin around every cell.'], ['Ion', 'An atom with an electric charge, like sodium (Na⁺).'], ['Co-transport', 'Two things carried across together.']],
    simplified: 'We draw it as a door that opens on one side, then the other. The real protein changes shape in a similar way, but it is a tangled chain of about 660 amino acids, not two flaps.',
    whys: [{ q: 'Why do they give you sugary, salty drinks when you\'re sick?', a: 'Because of this door. Sugar and salt go in together and water follows. Plain water alone is absorbed less well when you have diarrhoea.' }],
    art: {
      draw() {
        const heads = y => Array.from({ length: 34 }, (_, i) => {
          const x = 12 + i * 23.5;
          if (x > 300 && x < 500) return '';
          return `<circle cx="${x}" cy="${y}" r="10" ${paint('--membrane', '--flesh-line', 1.5)}/>`;
        }).join('');
        const tails = Array.from({ length: 34 }, (_, i) => {
          const x = 12 + i * 23.5;
          if (x > 300 && x < 500) return '';
          return `<path d="M${x - 3},268 L${x - 3},298 M${x + 3},268 L${x + 3},298 M${x - 3},312 L${x - 3},342 M${x + 3},312 L${x + 3},342" ${paint(null, '--ink-2', 1.5, 'opacity:.6')}/>`;
        }).join('');
        const r = rng(3);
        const naOut = Array.from({ length: 14 }, () => `<g transform="translate(${30 + r() * 740},${40 + r() * 170})"><circle r="14" ${paint('--na', null)}/><text y="5" text-anchor="middle" class="svg-note" style="font-size:12px;fill:var(--on-na);font-weight:700">Na⁺</text></g>`).join('');
        const naIn = Array.from({ length: 3 }, () => `<g transform="translate(${60 + r() * 680},${420 + r() * 150})"><circle r="14" ${paint('--na', null)}/><text y="5" text-anchor="middle" class="svg-note" style="font-size:12px;fill:var(--on-na);font-weight:700">Na⁺</text></g>`).join('');
        return `
          <rect x="0" y="0" width="800" height="250" ${paint('--lumen', null)}/>
          <rect x="0" y="350" width="800" height="250" ${paint('--flesh', null, 0, 'opacity:.55')}/>
          ${tails}${heads(258)}${heads(342)}
          ${naOut}${naIn}
          <g id="door">
            <path id="lflap" d="${blob(355, 300, 52, 110, { seed: 21, wob: 0.06 })}" ${paint('--dig', '--ink', 2.5, 'opacity:.92')}/>
            <path id="rflap" d="${blob(445, 300, 52, 110, { seed: 22, wob: 0.06 })}" ${paint('--dig', '--ink', 2.5, 'opacity:.92')}/>
          </g>
          <g id="cargo">
            <polygon id="gl" points="0,-16 14,-8 14,8 0,16 -14,8 -14,-8" ${paint('--glucose', '--ink', 2)}/>
            <g id="na1"><circle r="12" ${paint('--na', '--ink', 1.5)}/></g>
            <g id="na2"><circle r="12" ${paint('--na', '--ink', 1.5)}/></g>
          </g>
          ${label(20, 30, 'Gut side: lots of sodium', { anchor: 'start' })}
          ${label(20, 590, 'Inside the cell: little sodium', { anchor: 'start' })}
          ${label(780, 236, 'membrane', { anchor: 'end', size: 14 })}
          <text id="idle" x="600" y="470" text-anchor="middle" class="svg-note" style="font-size:17px;fill:var(--ink-2);font-weight:600">No sugar arriving. The door waits.</text>`;
      },
      live(c) {
        const busy = c.s.absorb > 0.03;
        c.mem.ph = (c.mem.ph || 0) + c.dt * (busy ? 0.35 + Math.min(1, c.s.absorb) * 0.5 : 0.08);
        const u = c.mem.ph % 1;
        const openTop = u < 0.45;
        const tilt = openTop ? 9 : -9;
        c.q('#lflap').setAttribute('transform', `rotate(${tilt} 355 ${openTop ? 410 : 190})`);
        c.q('#rflap').setAttribute('transform', `rotate(${-tilt} 445 ${openTop ? 410 : 190})`);
        const y = u < 0.3 ? 80 + (u / 0.3) * 200 : u < 0.6 ? 280 + ((u - 0.3) / 0.3) * 40 : 320 + ((u - 0.6) / 0.4) * 230;
        c.q('#gl').setAttribute('transform', `translate(400,${y})`);
        c.q('#na1').setAttribute('transform', `translate(370,${y - 30})`);
        c.q('#na2').setAttribute('transform', `translate(430,${y - 30})`);
        c.q('#cargo').style.opacity = busy ? 1 : 0;
        c.q('#idle').style.opacity = busy ? 0 : 1;
      },
    },
    now: s => s.absorb > 0.03 ? 'Turning over and over: two sodium and one glucose each time.' : 'Idle. No glucose on the gut side.',
  });

  // ---------- Large intestine ----------
  A.node({
    id: 'largeIntestine', parent: 'body', scale: 'organ', name: 'Large intestine', systems: ['digestion', 'immunity'],
    size: () => 'About 1.5 m long in an adult, about 6 cm wide',
    kid: 'The last part of the tube. It soaks water back up, and it is home to trillions of bacteria that eat the leftovers {name} couldn\'t digest. Most of them are friendly.',
    adult: `<p>By the time food arrives here, most nutrients are gone. The large intestine absorbs water and salts, and it holds the densest community of microbes in the body, the <strong>gut microbiota</strong>. They ferment fibre that our own enzymes can't digest, making short-chain fatty acids such as butyrate, which feed the cells of the colon wall. Some bacteria also make vitamin K.</p>
      <p>A healthy community helps crowd out harmful microbes and trains the immune system. This is the slowest part of the trip: food usually takes 1–3 days to pass all the way through the gut, and most of that time is spent here.</p>`,
    numbers: [
      { value: '≈ 38 trillion', what: 'bacteria in an adult, almost all of them here', who: 'adult', src: 'Sender, Fuchs & Milo 2016' },
      { value: '1–3 days', what: 'typical total time from eating to pooping; it varies widely between people', who: 'any' },
      { value: '≈ 75%', what: 'of poop is water. Of the rest, a large share is bacteria', who: 'any' },
    ],
    words: [['Microbiota', 'All the microbes living in one place, such as your gut.'], ['Fibre', 'Parts of plants our own enzymes cannot digest. Bacteria can.'], ['Ferment', 'How microbes break food down without oxygen, often making gas.']],
    myths: [{ myth: 'All bacteria are germs.', truth: 'Only a small fraction of bacteria cause disease. Your gut bacteria digest fibre for you and help keep harmful microbes out.' }],
    simplified: 'Bacteria are drawn huge and few. A real gram of colon contents holds tens of billions of them, from hundreds of different species.',
    whys: [{ q: 'Why do beans make you fart?', a: 'Beans contain sugars we can\'t digest. Bacteria in the large intestine ferment them and make gas.' }],
    notYet: 'The gut wall and its microbes up close',
    art: {
      draw() {
        const r = rng(8);
        const cols = ['--germ', '--imm', '--dig', '--ok', '--flesh-2'];
        const bugs = Array.from({ length: 70 }, (_, i) => {
          const x = 120 + r() * 560, y = 170 + r() * 260, a = r() * 180, l = 14 + r() * 16;
          return `<rect class="bug" x="${-l / 2}" y="-6" width="${l}" height="12" rx="6" transform="translate(${x},${y}) rotate(${a})" ${paint(cols[i % cols.length], null, 0, 'opacity:.9')}/>`;
        }).join('');
        const fibres = Array.from({ length: 6 }, () => { const x = 140 + r() * 480, y = 200 + r() * 200; return `<path d="M${x},${y} q30,-20 60,0 t60,0" ${paint(null, '--ok', 4, 'stroke-linecap:round;opacity:.7')}/>`; }).join('');
        return `
          <rect x="60" y="110" width="680" height="380" rx="150" ${paint('--flesh-2', '--flesh-line', 4)}/>
          <rect x="96" y="146" width="608" height="308" rx="120" ${paint('--mucus', null)}/>
          <rect x="116" y="166" width="568" height="268" rx="104" ${paint('--lumen', null)}/>
          ${fibres}
          <g id="bugs">${bugs}</g>
          <g id="water">${[160, 300, 440, 580].map(x => `<path d="M${x},140 q8,12 0,18 q-8,-6 0,-18z" ${paint('--water', null)}/>`).join('')}</g>
          ${label(400, 80, 'Water is soaked back up through the wall', { color: '--water' })}
          ${label(400, 530, 'Fibre (green strands) is food for bacteria', {})}`;
      },
      live(c) {
        c.mem.ph = (c.mem.ph || 0) + c.dt;
        c.q('#water').setAttribute('transform', `translate(0,${-((c.mem.ph * 20) % 60)})`);
        c.q('#bugs').setAttribute('transform', `translate(${Math.sin(c.mem.ph / 2) * 4},${Math.cos(c.mem.ph / 3) * 3})`);
      },
    },
    now(s) {
      const inColon = s.meals.filter(m => m.colon && !m.out);
      return inColon.length ? `Leftovers from ${inColon.length} meal${inColon.length > 1 ? 's' : ''} are here. Bacteria are fermenting the fibre.` : 'Bacteria are living on what is left from earlier meals.';
    },
  });

  // ---------- Simulation ----------
  A.process({
    id: 'digestion', order: 20,
    init(s, n) {
      setDefault(s, 'meals', []);
      setDefault(s, 'gutCarbs', 0);
      setDefault(s, 'absorb', 0);
      setDefault(s, 'glucose', n.glucoseBase);
      setDefault(s, 'lastMealAt', -1e9);
    },
    step(s, dt, ctx) {
      const n = ctx.norms, h = dt / 60;
      for (const m of s.meals) {
        if (m.inStomach > 0.001 && s.t - m.at > 600) {
          const out = m.inStomach * (1 - Math.exp(-Math.LN2 / m.ht * h));
          m.inStomach -= out;
          s.gutCarbs += out * m.carbs;
        }
        const hrs = (s.t - m.at) / 3600;
        if (!m.colon && hrs > 6) {
          m.colon = true;
          ctx.log(`Leftovers from the ${m.name.toLowerCase()} reached the large intestine. Bacteria get their turn.`, { sys: 'digestion', node: 'largeIntestine' });
        }
        if (!m.out && hrs > m.transit) {
          m.out = true;
          ctx.log(`The leftovers from the ${m.name.toLowerCase()} (${A.clock(m.at).text}) are ready to leave as poop. That trip took about ${Math.round(hrs)} hours.`, { sys: 'digestion', node: 'largeIntestine' });
        }
      }
      s.meals = s.meals.filter(m => !(m.out && m.inStomach < 0.001));
      const absorbed = s.gutCarbs * (1 - Math.exp(-Math.LN2 / 25 * h));
      s.gutCarbs -= absorbed;
      s.absorb = absorbed / h;
      const vd = 0.2 * n.weight;
      let g = s.glucose + s.absorb * 0.5 * 5.55 / vd * h;
      if (g > n.glucoseBase) g -= (g - n.glucoseBase) * (1 - Math.exp(-0.1 * h));
      else g += (n.glucoseBase - g) * (1 - Math.exp(-0.1 * h));
      g -= s.exertion * 0.03 * h * Math.max(0, g - 3.5) / 1.5;
      s.glucose = g;
      if (s.glucose > (s.glucosePeak || 0)) s.glucosePeak = s.glucose;
    },
    happening(s, n, body) {
      const out = [];
      const f = stomachFill(s, n);
      if (f > 0.02) out.push({ text: `Stomach ${Math.round(f * 100)}% full`, node: 'stomach', sys: 'digestion' });
      if (s.absorb > 0.05) out.push({ text: 'Absorbing sugar into the blood', node: 'villus', sys: 'digestion' });
      if (s.meals.some(m => m.colon && !m.out)) out.push({ text: 'Leftovers in the large intestine', node: 'largeIntestine', sys: 'digestion' });
      if (f < 0.02 && s.t - s.lastMealAt > 4.5 * 3600 && s.t - s.lastMealAt < 1e8 && s.t >= s.asleepUntil) out.push({ text: `${body.name} is getting hungry`, node: 'stomach', sys: 'digestion' });
      return out;
    },
  });

  A.vital({
    id: 'glucose', order: 40, label: 'Blood sugar',
    unit: u => u.glucose === 'mg' ? 'mg/dL' : 'mmol/L',
    value: s => s.glucose,
    fmt: (v, u) => u.glucose === 'mg' ? Math.round(v * 18) : v.toFixed(1),
    status: v => v < 3.9 ? 'low' : v > 7.8 ? 'high' : 'ok',
    node: 'blood',
  });

  A.vital({
    id: 'stomach', order: 50, label: 'Stomach', unit: 'full',
    value: (s, n) => stomachFill(s, n) * 100,
    fmt: v => Math.round(v) + '%',
    status: () => 'ok',
    node: 'stomach',
  });

  const FOODS = {
    lunch: { label: 'Lunch', detail: 'pasta, peas and milk', name: 'Lunch', carbs: 60, mass: 450, ht: 100, transit: 32 },
    apple: { label: 'An apple', detail: 'about 15 g of sugar, lots of fibre', name: 'Apple', carbs: 15, mass: 180, ht: 45, transit: 30 },
    juice: { label: 'Juice', detail: 'a glass, about 25 g of sugar', name: 'Juice', carbs: 25, mass: 250, ht: 20, transit: 30 },
  };
  A.action({
    id: 'eat', label: 'Eat', key: 'e', icon: 'eat', watch: ['stomach', 'villus', 'blood'],
    options: Object.entries(FOODS).map(([id, f]) => ({ id, label: f.label, detail: f.detail })),
    blocked: s => s.t < s.asleepUntil ? 'Asleep right now' : null,
    run(s, ctx, opt) {
      const f = FOODS[opt] || FOODS.lunch;
      s.meals.push({ id: Math.random().toString(36).slice(2, 8), name: f.name, at: s.t, carbs: f.carbs, mass: f.mass, ht: f.ht, inStomach: 1, transit: f.transit + Math.round(Math.random() * 12) });
      s.lastMealAt = s.t;
      s.mealsEaten = (s.mealsEaten || 0) + 1;
      s.glucosePeak = s.glucose;
      ctx.log(`Ate ${f.label.toLowerCase()} (${f.detail}).`, { sys: 'digestion', node: 'stomach' });
      return { tip: 'Follow the food: stomach first, then the small intestine. Blood sugar rises within about half an hour.' };
    },
  });
})(window.Atlas);
