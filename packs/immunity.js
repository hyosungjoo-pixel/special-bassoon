/*
 * Pack: immunity.
 * Lymph node → germinal centre → B cell → antibody; neutrophils (from the blood); skin.
 * Simulation: a small model with three numbers per infection:
 *   L  how much germ there is (0–1 of the most the body would allow)
 *   I  innate response (fast, general: fever, neutrophils)
 *   A  adaptive response (slow the first time, fast with memory: antibodies)
 * Vaccines build memory without the germ.
 */
(function (A) {
  'use strict';
  const { setDefault, clamp, approach } = A.util;
  const { paint, label, smooth, blob, rng, along } = A.draw;

  A.system({ id: 'immunity', name: 'Immunity', color: '--imm' });

  // Rates are per hour. Numbers are tuned so the story's timing matches typical illness, not measured constants.
  A.germ({
    id: 'flu', name: 'Flu virus', kind: 'virus', entry: 'nose and throat', systemic: true,
    r: 0.12, L0: 0.002, kI: 0.16, aI: 0.5, dI: 0.05, kA: 0.7,
    delay: { first: 120, memory: 24 }, gA: { first: 0.035, memory: 0.12 },
    vaccine: { name: 'Flu vaccine', target: 0.35 },
  });
  A.germ({
    id: 'scrape', name: 'Scraped knee', kind: 'bacteria', entry: 'a scrape on the knee', systemic: false,
    r: 0.1, L0: 0.05, kI: 0.6, aI: 3, dI: 0.02, kA: 0.3,
    delay: { first: 96, memory: 24 }, gA: { first: 0.03, memory: 0.1 },
  });

  const maxI = s => Object.values(s.infections).reduce((m, f) => Math.max(m, f.I), 0);
  const training = s => s.vaccines.find(v => !v.done);
  const fluLoad = s => (s.infections.flu ? s.infections.flu.L : 0);

  // ---------- Body overlay ----------
  const NODES = [[380, 122], [420, 122], [332, 168], [468, 168], [372, 352], [428, 352]];
  A.extend('body', {
    id: 'immunity', order: 30, systems: ['immunity'],
    draw() {
      return NODES.map(([x, y], i) => `<ellipse class="ln" data-i="${i}" cx="${x}" cy="${y}" rx="6" ry="4" ${paint('--imm', '--ink', 1)}/>`).join('') +
        `<g id="wound"></g><g id="virions"></g>`;
    },
    live(c) {
      const s = c.s;
      const act = Math.max(maxI(s), training(s) ? 0.5 : 0);
      c.root.querySelectorAll('.ln').forEach(el => { el.setAttribute('rx', 6 + act * 5); el.setAttribute('ry', 4 + act * 4); });
      const w = c.q('#wound');
      const ph = woundPhase(s);
      const key = ph ? ph.id + Math.round(ph.heal * 5) : '';
      if (w.dataset.k !== key) {
        w.dataset.k = key;
        w.innerHTML = ph ? `<ellipse cx="436" cy="462" rx="${12 - ph.heal * 8}" ry="${8 - ph.heal * 5}" ${paint(ph.id === 'bleeding' ? '--blood-o2' : '--scab', null)}/>` : '';
      }
      const v = c.q('#virions');
      const k = Math.round(clamp(fluLoad(s) * 30, 0, 12));
      if (v.childElementCount !== k) v.innerHTML = Array.from({ length: k }, () => `<circle r="3.5" ${paint('--germ', '--ink', 1)}/>`).join('');
      c.mem.ph = (c.mem.ph || 0) + c.dt;
      [...v.children].forEach((el, i) => { el.setAttribute('cx', 400 + Math.cos(c.mem.ph + i * 1.9) * (14 + i * 2)); el.setAttribute('cy', 82 + Math.sin(c.mem.ph * 1.3 + i) * (8 + i)); });
    },
    hotspots: [
      { to: 'lymphNode', at: [420, 122], label: 'Lymph node', side: 'right', anchor: [610, 104] },
      { to: 'skin', at: [436, 462], label: 'Skin (knee)', side: 'right', anchor: [610, 462] },
    ],
  });

  function woundPhase(s) {
    if (!s.wound) return null;
    const mins = (s.t - s.wound.at) / 60;
    const heal = clamp((s.t - s.wound.at) / (7 * 86400), 0, 1);
    if (mins < 8) return { id: 'bleeding', heal };
    if (mins < 60) return { id: 'clotting', heal };
    return { id: heal < 0.4 ? 'scab' : 'healing', heal };
  }

  // ---------- Lymph node ----------
  const BEAN = [[150, 170], [260, 90], [400, 70], [540, 100], [640, 190], [620, 270], [580, 300], [620, 340], [640, 420], [540, 510], [400, 530], [260, 500], [150, 420], [110, 300]];
  const FOLL = [[200, 200], [300, 130], [430, 115], [540, 160], [170, 330], [220, 440], [340, 480], [470, 470]];
  A.node({
    id: 'lymphNode', parent: 'body', scale: 'organ', name: 'Lymph node', systems: ['immunity'],
    size: () => 'Usually smaller than 1 cm',
    kid: 'Lymph nodes are bean-shaped meeting places for defender cells. When {name} is ill, the ones in the neck can swell up. That means they are busy training an army.',
    adult: `<p>Fluid constantly leaks out of capillaries into the tissues. Lymph vessels collect it as <strong>lymph</strong>, filter it through lymph nodes, and return it to the blood. Dendritic cells carry pieces of germs (<strong>antigens</strong>) from the tissues to the nodes. There, the rare B and T cells whose receptors happen to fit get activated and multiply. That is the <strong>adaptive</strong> immune response.</p>
      <p>The first time takes days, which is why a new illness lasts a while. Afterwards, <strong>memory cells</strong> stay behind, and the next response starts within a day or two and is much stronger.</p>
      <p><strong>Vaccines</strong> run this training without the danger. Most flu vaccines contain inactivated virus or just one of its proteins, so they cannot cause flu. Protection builds over about two weeks. Flu viruses keep changing, so the vaccine is updated every year. In a typical season it prevents roughly 40–60% of flu illness when it is well matched, and it makes illness milder on average.</p>`,
    numbers: [
      { value: '≈ 450–700', what: 'lymph nodes in an adult (estimates vary)', who: 'adult' },
      { value: '1–2 weeks', what: 'for a first antibody response to peak', who: 'any' },
      { value: '1–3 days', what: 'for a memory response to get going', who: 'any' },
      { value: '≈ 2 weeks', what: 'after a flu vaccine before protection builds', who: 'any', src: 'CDC' },
    ],
    words: [['Lymph', 'Clear fluid collected from the tissues and filtered by lymph nodes.'], ['Antigen', 'Any piece of a germ (or other thing) that immune cells can recognise.'], ['Adaptive immunity', 'The slow, precise part of the immune system that learns and remembers.'], ['Innate immunity', 'The fast, general part: fever, inflammation, neutrophils.']],
    myths: [
      { myth: 'Antibiotics will cure the flu.', truth: 'Antibiotics kill bacteria. Flu is a virus, so they don\'t help. The immune system does the work. Antiviral medicines exist for some people at higher risk.' },
      { myth: 'Fever is the illness.', truth: 'Fever is part of the defence. A higher temperature slows some microbes and speeds up some immune cells. Doctors treat a fever mainly to keep a child comfortable.' },
    ],
    simplified: 'In the simulator, a flu infection is described by three numbers (germ amount, innate response, adaptive response), tuned so the timing looks like a typical flu. Real infections vary a lot from person to person.',
    whys: [
      { q: 'Why do I get ill for a week the first time?', a: 'Only a few of your B and T cells fit any new germ. They need days to multiply into an army. Meanwhile the fast innate defences (fever, inflammation) hold the germ back, and that is a lot of what feeling ill is.' },
      { q: 'Why does the flu vaccine need doing every year?', a: 'Flu viruses keep changing their outer proteins, so last year\'s antibodies may not fit, and antibody levels also fade over months.' },
    ],
    art: {
      draw() {
        const r = rng(2);
        const cells = Array.from({ length: 60 }, () => `<circle cx="${180 + r() * 420}" cy="${130 + r() * 350}" r="4" ${paint('--imm', null, 0, 'opacity:.5')}/>`).join('');
        return `
          <path d="M20,120 C80,150 110,170 150,190 M40,470 C90,450 120,430 155,410 M300,10 C300,40 300,60 290,92" ${paint(null, '--lacteal', 16, 'stroke-linecap:round')}/>
          <path d="M600,300 C680,300 730,280 790,250" ${paint(null, '--lacteal', 18, 'stroke-linecap:round')}/>
          <path d="M600,318 C690,330 740,340 790,350" ${paint(null, '--blood-o2', 12, 'stroke-linecap:round')}/>
          <path d="M600,334 C690,360 740,380 790,390" ${paint(null, '--blood-low', 12, 'stroke-linecap:round')}/>
          <g id="swell">
            <path d="${smooth(BEAN, true)}" ${paint('--node', '--imm', 5)}/>
            <path d="${blob(390, 300, 150, 120, { seed: 12, wob: 0.15 })}" ${paint('--flesh', null, 0, 'opacity:.45')}/>
            ${cells}
            ${FOLL.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="42" ${paint('--follicle', '--imm', 2)}/><circle class="gc" cx="${x}" cy="${y}" r="${i === 0 ? 22 : 0}" ${paint('--gc', null)}/>`).join('')}
          </g>
          ${label(20, 100, 'Lymph in', { anchor: 'start', color: '--ink' })}
          ${label(790, 230, 'Lymph out', { anchor: 'end', color: '--ink' })}
          ${label(790, 420, 'Blood in and out', { anchor: 'end' })}
          ${label(390, 300, 'Middle: cells leave from here', { size: 14, color: '--ink' })}
          ${label(400, 585, 'Circles near the edge are follicles, full of B cells', { size: 14 })}`;
      },
      live(c) {
        const s = c.s;
        const act = Math.max(maxI(s), training(s) ? 0.6 : 0, s.infections.flu ? s.infections.flu.A : 0);
        const k = 1 + act * 0.1;
        c.q('#swell').setAttribute('transform', `translate(${380 * (1 - k)},${300 * (1 - k)}) scale(${k})`);
        c.root.querySelectorAll('.gc').forEach((el, i) => el.setAttribute('r', i === 0 ? 22 : act > 0.25 && i < 5 ? 10 + act * 18 : 0));
      },
      hotspots: [{ to: 'germinalCenter', at: [200, 200], label: 'Germinal centre', side: 'left', anchor: [150, 40] }],
    },
    now(s, body) {
      const f = s.infections.flu;
      const v = training(s);
      if (f && f.A > 0.2) return 'Swollen and busy: pumping out antibodies against flu.';
      if (f) return f.I > 0.3 ? `Working hard. Matching B cells are multiplying, but antibodies need a few more days.` : 'The first flu pieces are arriving. The search for matching cells has begun.';
      if (v) return `Training on the flu vaccine: day ${Math.floor((s.t - v.at) / 86400) + 1} of about 14.`;
      return 'Quiet. Lymph trickles through and gets checked for anything new.';
    },
  });

  // ---------- Germinal centre ----------
  A.node({
    id: 'germinalCenter', parent: 'lymphNode', scale: 'tissue', name: 'Germinal centre', systems: ['immunity'],
    size: () => 'About 0.1–0.5 mm across',
    kid: 'Inside the lymph node, B cells go to training camp. Each one has a slightly different grabber. The ones that grab the germ best win, and make lots of copies of themselves.',
    adult: `<p>When a B cell is activated, it moves into a follicle and starts a <strong>germinal centre</strong>. In the dark zone the cells divide fast and deliberately mutate the genes for their receptor (<strong>somatic hypermutation</strong>). In the light zone they test the new versions against antigen held by follicular dendritic cells. Only those that bind better get survival signals from T follicular helper cells.</p>
      <p>Round after round, binding improves. This is <strong>affinity maturation</strong>: evolution by selection, running inside you over one to a few weeks. The winners become <strong>plasma cells</strong>, which pump out antibodies, and long-lived <strong>memory B cells</strong>.</p>`,
    numbers: [
      { value: '≈ 6–12 h', what: 'between divisions for a B cell in the dark zone', who: 'any' },
      { value: '1–3 weeks', what: 'that a germinal centre keeps running after an infection or vaccine', who: 'any' },
      { value: '50+ years', what: 'memory B cells were still found after smallpox vaccination', who: 'adult', src: 'Crotty et al., J Immunol 2003' },
    ],
    words: [['Mutation', 'A change in a gene. Here it happens on purpose, only in the receptor genes.'], ['Affinity', 'How tightly two molecules stick together.'], ['Plasma cell', 'A B cell turned into an antibody factory.'], ['Memory cell', 'A long-lived cell that remembers a germ.']],
    simplified: 'The training is shown as cells drifting between two zones. Real selection involves helper T cells and many cycles, and dozens of germinal centres run at the same time.',
    whys: [{ q: 'Why don\'t the mutations cause cancer?', a: 'The mutation machinery mostly targets the receptor genes and is switched on only in germinal centres. Mistakes do sometimes happen, and some lymphomas start this way, but tight checks keep it rare.' }],
    art: {
      draw() {
        return `
          <circle cx="400" cy="300" r="270" ${paint('--follicle', '--imm', 4)}/>
          <path d="M400,30 A270,270 0 0 0 400,570 Z" ${paint('--gc-dark', null)}/>
          ${[[540, 180], [600, 320], [520, 430], [470, 280]].map(([x, y]) => `<path d="M${x - 30},${y} L${x + 30},${y} M${x},${y - 30} L${x},${y + 30} M${x - 21},${y - 21} L${x + 21},${y + 21} M${x - 21},${y + 21} L${x + 21},${y - 21}" ${paint(null, '--fdc', 5, 'stroke-linecap:round')}/><circle cx="${x + 26}" cy="${y - 8}" r="7" ${paint('--germ', '--ink', 1)}/>`).join('')}
          ${[[620, 230], [560, 360]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" ${paint('--ok', '--ink', 1.5)}/>`).join('')}
          <g id="bcells"></g>
          <g transform="translate(250,300)"><circle r="26" ${paint('--imm', '--ink', 3)}/><path d="M0,-26 v-12 m0,0 l-7,-8 m7,8 l7,-8" ${paint(null, '--ink', 3, 'stroke-linecap:round')}/></g>
          ${label(250, 120, 'Dark zone', { color: '--ink', size: 18 })}
          ${label(250, 142, 'divide and mutate', { size: 14 })}
          ${label(560, 110, 'Light zone', { color: '--ink', size: 18 })}
          ${label(560, 132, 'test the grip on the germ', { size: 14 })}
          ${label(400, 594, 'Stars: cells holding germ pieces · green: helper T cells', { size: 13 })}`;
      },
      live(c) {
        const s = c.s;
        const busy = !!(s.infections.flu || training(s));
        const n = busy ? 26 : 8;
        const g = c.q('#bcells');
        if (g.childElementCount !== n) {
          const r = rng(9);
          g.innerHTML = Array.from({ length: n }, (_, i) => `<g data-r="${r()}" data-a="${r() * 6.28}"><circle r="13" style="fill:hsl(${230 + (i % 6) * 18} 60% 65%);stroke:var(--ink);stroke-width:1"/></g>`).join('');
        }
        c.mem.ph = (c.mem.ph || 0) + c.dt * (busy ? 0.25 : 0.06);
        [...g.children].forEach(el => {
          const a = +el.dataset.a + c.mem.ph * (0.5 + +el.dataset.r);
          const rad = 60 + +el.dataset.r * 170;
          el.setAttribute('transform', `translate(${(400 + Math.cos(a) * rad).toFixed(1)},${(300 + Math.sin(a) * rad * 0.9).toFixed(1)})`);
        });
      },
      hotspots: [{ to: 'bCell', at: [250, 300], label: 'One B cell', side: 'left', anchor: [120, 470] }],
    },
    now: s => (s.infections.flu || training(s)) ? 'Running: B cells are dividing, mutating and competing.' : 'Resting. A few memory cells and plenty of naïve B cells waiting.',
  });

  // ---------- B cell ----------
  A.node({
    id: 'bCell', parent: 'germinalCenter', scale: 'cell', name: 'B cell', systems: ['immunity'],
    size: () => 'About 7–10 µm across',
    kid: 'Every B cell has its own grabber shape, made by chance before it ever meets a germ. {name} has so many different ones that there is almost always one that fits a new germ.',
    adult: `<p>Each B cell carries many copies of <strong>one</strong> receptor, the B cell receptor, which is an antibody fixed to its surface. The receptor is built by randomly cutting and joining gene segments (<strong>V(D)J recombination</strong>) as the cell develops in the bone marrow. The number of possible receptors is enormous, far more than the number of B cells in a body, so each person carries a different random sample.</p>
      <p>Cells whose receptor sticks to the body's own molecules are mostly removed during development. When a B cell's receptor fits an antigen and it gets help from a T cell, it divides. Some of its offspring become plasma cells, which release the same antibody into the blood by the thousands every second.</p>`,
    numbers: [
      { value: '1', what: 'receptor shape per B cell (in many copies)', who: 'any' },
      { value: 'thousands', what: 'antibodies released every second by one plasma cell; estimates vary', who: 'any' },
    ],
    words: [['Receptor', 'A molecule on a cell\'s surface that recognises one specific shape.'], ['V(D)J recombination', 'Shuffling gene pieces to make a new receptor.'], ['Naïve B cell', 'A B cell that has not met its antigen yet.']],
    myths: [{ myth: 'Too many vaccines overload a child\'s immune system.', truth: 'A child\'s immune system meets a huge number of new antigens every day from food, dust and microbes. All the vaccines on a childhood schedule together add only a small number of extra antigens.' }],
    simplified: 'The receptors are drawn as big Y shapes on a smooth ball. A real B cell is covered in tens of thousands of them, too small to see with a light microscope.',
    whys: [{ q: 'How can my body have a key for a germ it\'s never seen?', a: 'It doesn\'t plan ahead. It makes a vast random collection of receptors, so by chance a few fit almost anything. Then the ones that fit get copied.' }],
    art: {
      draw() {
        const ys = Array.from({ length: 22 }, (_, i) => {
          const a = (i / 22) * Math.PI * 2, x = 330 + Math.cos(a) * 160, y = 300 + Math.sin(a) * 160, d = a * 180 / Math.PI + 90;
          return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${d.toFixed(1)})"><path d="M0,0 V-22 M0,-22 L-10,-36 M0,-22 L10,-36" ${paint(null, '--imm', 5, 'stroke-linecap:round')}/></g>`;
        }).join('');
        const spikes = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return `<path d="M${640 + Math.cos(a) * 70},${300 + Math.sin(a) * 70} L${640 + Math.cos(a) * 92},${300 + Math.sin(a) * 92}" ${paint(null, '--germ', 8, 'stroke-linecap:round')}/>`; }).join('');
        return `
          <circle cx="330" cy="300" r="160" ${paint('--wbc', '--imm', 4)}/>
          <circle cx="345" cy="295" r="105" ${paint('--nucleus', null, 0, 'opacity:.8')}/>
          ${ys}
          <g id="virus"><circle cx="640" cy="300" r="70" ${paint('--germ', '--ink', 2, 'opacity:.55')}/>${spikes}</g>
          ${label(330, 60, 'Every receptor on one cell is the same shape', { color: '--ink' })}
          ${label(640, 420, 'Flu virus (about 0.1 µm, drawn huge)', { size: 14 })}
          ${label(345, 300, 'nucleus', { color: '--on-blood', size: 16 })}`;
      },
      live(c) {
        c.mem.ph = (c.mem.ph || 0) + c.dt;
        c.q('#virus').setAttribute('transform', `translate(${Math.sin(c.mem.ph / 1.5) * 10},${Math.cos(c.mem.ph / 2) * 8})`);
      },
      hotspots: [{ to: 'antibody', at: [330, 118], label: 'Its receptor, set free: an antibody', side: 'right', anchor: [520, 120] }],
    },
    now: s => s.infections.flu && s.infections.flu.A > 0.1 ? 'Flu-matching B cells have become plasma cells and are releasing antibodies.' : (s.immune.flu && s.immune.flu.memory ? 'Memory B cells for flu are on standby.' : 'Waiting to meet a germ that fits.'),
  });

  // ---------- Antibody ----------
  const seg = (x1, y1, x2, y2, w, col) => `<path d="M${x1},${y1} L${x2},${y2}" ${paint(null, col, w, 'stroke-linecap:round')}/>`;
  A.node({
    id: 'antibody', parent: 'bCell', scale: 'molecule', name: 'Antibody', systems: ['immunity'],
    size: () => 'About 10–15 nm across',
    kid: 'This Y-shaped molecule is an antibody. Its two tips grab onto a germ and hold on, so the germ can\'t get into {name}\'s cells. It also works like a flag that says "eat this one".',
    adult: `<p>The most common antibody in blood, <strong>IgG</strong>, is built from two heavy and two light protein chains. The tips of the arms (the variable regions) differ from one B cell to the next and form the binding site, so each antibody has two identical grips. The stem (Fc) is the same for all IgG and is what other immune cells and proteins recognise.</p>
      <p>Antibodies <strong>neutralise</strong> germs by blocking the parts they use to enter cells, <strong>flag</strong> them for eating by phagocytes, and trigger complement proteins that punch holes in bacteria. The body actually makes more <strong>IgA</strong> than any other kind, mostly released into the gut, where it guards the lining. That is another place where digestion and immunity meet.</p>`,
    numbers: [
      { value: '2', what: 'binding tips on an IgG; IgM, made first in a new response, has 10', who: 'any' },
      { value: '≈ 3 weeks', what: 'half-life of IgG in blood. Antibody levels fade; memory cells stay', who: 'any' },
      { value: '5', what: 'classes: IgG, IgA, IgM, IgE, IgD', who: 'any' },
    ],
    words: [['Neutralise', 'To block a germ so it can\'t infect a cell.'], ['IgG / IgA', 'Antibody classes. IgG is common in blood; IgA guards the gut, airways and saliva.'], ['Phagocyte', 'A cell that eats germs, such as a neutrophil.']],
    myths: [{ myth: 'Once you have antibodies, you are protected forever.', truth: 'Antibody levels fall over months. Long-term protection comes from memory cells, and some germs, like flu, change their coat so old antibodies fit less well.' }],
    simplified: 'Each chain is drawn as a straight bar. Real antibodies are made of folded segments (domains) linked by a flexible hinge, so the arms can swing.',
    whys: [{ q: 'Why do babies not get sick as much in the first months?', a: 'IgG antibodies cross the placenta from the mother before birth, and breast milk adds IgA for the gut. That borrowed protection fades over the first months.' }],
    art: {
      draw() {
        return `
          <g id="ab">
            ${seg(388, 560, 388, 330, 26, '--hb-b')}${seg(412, 560, 412, 330, 26, '--hb-b')}
            ${seg(388, 330, 230, 150, 26, '--hb-b')}${seg(412, 330, 570, 150, 26, '--hb-b')}
            ${seg(350, 320, 205, 180, 20, '--hb-a')}${seg(450, 320, 595, 180, 20, '--hb-a')}
            ${seg(230, 150, 190, 104, 28, '--dig')}${seg(570, 150, 610, 104, 28, '--dig')}
          </g>
          <g id="ag">
            <path d="${blob(160, 70, 52, 34, { seed: 51, wob: 0.15 })}" ${paint('--germ', '--ink', 2)}/>
            <path d="${blob(640, 70, 52, 34, { seed: 52, wob: 0.15 })}" ${paint('--germ', '--ink', 2)}/>
          </g>
          ${label(400, 30, 'Germ proteins (green) caught by the tips', { color: '--ink' })}
          ${label(120, 260, 'Binding tips:', { anchor: 'start', color: '--ink' })}
          ${label(120, 280, 'different on every B cell', { anchor: 'start', size: 14 })}
          ${label(660, 300, 'Heavy chains (long)', { anchor: 'start', size: 14 })}
          ${label(660, 320, 'Light chains (short)', { anchor: 'start', size: 14 })}
          ${label(440, 470, 'Stem: tells other cells', { anchor: 'start', color: '--ink' })}
          ${label(440, 490, '"eat this"', { anchor: 'start', size: 14 })}
          <path d="M300,590 H500" ${paint(null, '--ink', 3)}/>${label(400, 580, '≈ 10 nm', { size: 14, color: '--ink' })}`;
      },
      live(c) {
        c.mem.ph = (c.mem.ph || 0) + c.dt;
        const w = Math.sin(c.mem.ph * 1.4) * 2;
        c.q('#ab').setAttribute('transform', `rotate(${w.toFixed(2)} 400 400)`);
        c.q('#ag').setAttribute('transform', `rotate(${w.toFixed(2)} 400 400)`);
      },
    },
    now: (s) => {
      const f = s.infections.flu, m = s.immune.flu;
      if (f && f.A > 0.1) return 'Flu antibodies are flooding the blood and airways.';
      if (m && m.A > 0.05) return `Flu antibodies are still in the blood from ${m.source === 'vaccine' ? 'the vaccine' : 'the last flu'}, slowly fading.`;
      return 'No antibodies against flu yet.';
    },
  });

  // ---------- Neutrophil ----------
  A.node({
    id: 'neutrophil', parent: 'blood', scale: 'cell', name: 'Neutrophil', systems: ['immunity', 'circulation'],
    size: () => 'About 12–15 µm across',
    kid: 'Neutrophils are first responders. When germs get in, they squeeze out of the blood vessel, follow the smell of trouble, and swallow germs whole.',
    adult: `<p>Neutrophils are the most common white blood cell and part of the <strong>innate</strong> immune system: fast and general, with no learning. Damaged tissue and bacteria release chemical signals. Neutrophils roll along the vessel wall, stick, and squeeze between the wall cells (<strong>diapedesis</strong>), helped by their flexible, multi-lobed nucleus. Then they follow the chemical trail (<strong>chemotaxis</strong>).</p>
      <p>They kill by swallowing microbes (<strong>phagocytosis</strong>), by enzymes and bursts of reactive oxygen, and by casting sticky nets made of their own DNA. They live only hours to a few days, and pus is largely dead neutrophils.</p>`,
    numbers: [
      { value: '40–70%', what: 'of white blood cells in adults; young children often have a lower share', who: 'any' },
      { value: '≈ 100 billion', what: 'neutrophils made by the bone marrow each day', who: 'adult' },
      { value: 'hours to days', what: 'how long one lives once it leaves the marrow', who: 'any' },
    ],
    words: [['Phagocytosis', '"Cell eating": wrapping around something and swallowing it.'], ['Chemotaxis', 'Moving towards a chemical signal.'], ['Inflammation', 'Redness, heat, swelling and pain as vessels widen and defenders arrive.']],
    simplified: 'One neutrophil is shown squeezing out while another eats. In a real scrape, thousands arrive within hours.',
    whys: [
      { q: 'What is pus?', a: 'Mostly dead neutrophils, along with bacteria and broken-down tissue. It shows the battle happened.' },
      { q: 'Why does a cut get red, hot and puffy?', a: 'Vessels nearby widen and leak a little so more blood and defenders reach the spot. More blood means red and warm, and the leaked fluid makes it puffy.' },
    ],
    art: {
      draw() {
        const wall = Array.from({ length: 9 }, (_, i) => `<rect x="${i * 92 - 10}" y="180" width="84" height="38" rx="16" ${paint('--flesh-2', '--flesh-line', 2)}/>`).join('');
        return `
          <rect x="0" y="0" width="800" height="180" ${paint('--plasma', null)}/>
          ${[[80, 80], [200, 120], [320, 60], [640, 90], [740, 140]].map(([x, y]) => `<ellipse class="rb" data-x="${x}" cx="${x}" cy="${y}" rx="24" ry="12" ${paint('--blood-o2', '--blood-low', 2)}/>`).join('')}
          ${wall}
          <rect x="0" y="218" width="800" height="382" ${paint('--flesh', null, 0, 'opacity:.55')}/>
          <g id="squeezer"><path d="M375,150 C375,120 425,120 425,150 L410,200 C440,215 450,260 400,270 C350,260 360,215 390,200 Z" ${paint('--wbc', '--imm', 3)}/>
            <path d="M386,150 a8,8 0 1 1 14,4 a8,8 0 1 1 12,6" ${paint(null, '--nucleus', 7, 'stroke-linecap:round')}/></g>
          <g transform="translate(600,440)"><circle r="56" ${paint('--wbc', '--imm', 3)}/><path d="M-26,-10 a12,12 0 1 1 18,6 a12,12 0 1 1 18,-4 a12,12 0 1 1 10,16" ${paint(null, '--nucleus', 10, 'stroke-linecap:round')}/>
            <rect x="0" y="12" width="30" height="12" rx="6" ${paint('--germ', '--ink', 1.5)}/></g>
          <g id="bacteria"></g>
          ${label(20, 30, 'Inside the blood vessel', { anchor: 'start', color: '--ink' })}
          ${label(20, 590, 'Outside, in the tissue', { anchor: 'start', color: '--ink' })}
          ${label(600, 530, 'Swallowing a bacterium', { size: 14 })}
          <text id="calm" x="230" y="420" text-anchor="middle" class="svg-note" style="font-size:16px;fill:var(--ink-2);font-weight:600">No germs here. Just patrolling.</text>`;
      },
      live(c) {
        const s = c.s;
        const L = s.infections.scrape ? s.infections.scrape.L : 0;
        const n = Math.round(clamp(L * 60, 0, 14));
        const g = c.q('#bacteria');
        if (g.childElementCount !== n) {
          const r = rng(6);
          g.innerHTML = Array.from({ length: n }, () => `<rect x="${120 + r() * 340}" y="${320 + r() * 220}" width="30" height="12" rx="6" transform="rotate(${r() * 180})" style="transform-box:fill-box;transform-origin:center;fill:var(--germ);stroke:var(--ink);stroke-width:1.5"/>`).join('');
        }
        c.q('#calm').style.opacity = n ? 0 : 1;
        c.mem.ph = (c.mem.ph || 0) + c.dt * 0.15;
        const u = c.mem.ph % 1;
        c.q('#squeezer').setAttribute('transform', `translate(0,${(u * 200 - 40).toFixed(1)})`);
        c.mem.x = (c.mem.x || 0) + c.dt * s.hr;
        c.root.querySelectorAll('.rb').forEach(el => el.setAttribute('cx', ((+el.dataset.x + c.mem.x) % 860) - 30));
      },
    },
    now: s => s.infections.scrape ? 'Swarming the scrape and eating bacteria.' : maxI(s) > 0.3 ? 'More of them in the blood than usual: the body is fighting something.' : 'Rolling along vessel walls, on patrol.',
  });

  // ---------- Skin ----------
  A.node({
    id: 'skin', parent: 'body', scale: 'tissue', name: 'Skin', systems: ['immunity', 'circulation'],
    size: () => 'This view is about 1 mm deep',
    kid: 'Skin is a wall that keeps germs out. A scrape opens a gap, and the body rushes to close it: platelets plug the leak, and white cells come to clean up.',
    adult: `<p>The outer layer, the <strong>epidermis</strong>, is a stack of cells that are made at the bottom, flatten as they rise, and are shed as dead flakes at the top. Below it, the <strong>dermis</strong> holds blood vessels, nerves and hair roots. Skin is a physical barrier, slightly acidic and home to its own harmless microbes.</p>
      <p>When it is broken, three overlapping stages follow. <strong>Stop the bleeding</strong>: vessels narrow, platelets stick together within seconds to minutes, and a fibrin mesh makes a clot that dries into a scab. <strong>Inflammation</strong>: neutrophils arrive within hours, then macrophages clean up. <strong>Repair</strong>: new skin cells creep in from the edges, usually closing a small scrape in one to two weeks. Soil can carry tetanus bacteria, which is why the tetanus vaccine is kept up to date.</p>`,
    numbers: [
      { value: '0.05–1.5 mm', what: 'epidermis thickness, from eyelids to the soles of the feet', who: 'any' },
      { value: '≈ 1 month', what: 'for the epidermis to renew itself; slower with age', who: 'any' },
      { value: '1–2 weeks', what: 'for a small scrape to close', who: 'any' },
    ],
    words: [['Epidermis', 'The outer layer of skin.'], ['Dermis', 'The thicker layer underneath, with vessels and nerves.'], ['Fibrin', 'Protein threads that form the mesh of a clot.'], ['Scab', 'A dried clot that covers a wound while it heals.']],
    myths: [{ myth: 'Let a cut dry out in the air so it heals faster.', truth: 'Small wounds usually heal faster and scar less when they are cleaned and kept covered and slightly moist. A scab is a temporary patch, not the healing itself.' }],
    simplified: 'Layers are shown flat and thick. The bacteria, cells and fibrin are drawn far bigger than scale.',
    whys: [{ q: 'Why does a scab itch?', a: 'New skin is growing underneath, and the nerve endings in it are being stimulated as the wound tightens and repairs. Picking it can reopen the wound.' }],
    art: {
      draw() {
        const epi = [];
        for (let row = 0; row < 4; row++) for (let i = 0; i < 17; i++) {
          const x = i * 50 - (row % 2) * 25, y = 150 + row * 22;
          epi.push(`<rect class="epi" data-x="${x + 22}" x="${x}" y="${y}" width="46" height="${20 - row * 3}" rx="6" ${paint('--flesh', '--flesh-line', 1.2)}/>`);
        }
        const caps = [150, 400, 650].map(x => `<path d="M${x - 50},600 C${x - 50},330 ${x + 50},330 ${x + 50},600" ${paint(null, 'url(#skcap)', 9)}/>`).join('');
        return `
          <defs><linearGradient id="skcap"><stop offset="0" style="stop-color:var(--blood-o2)"/><stop offset="1" style="stop-color:var(--blood-low)"/></linearGradient></defs>
          <rect x="0" y="0" width="800" height="150" ${paint('--bg-2', null)}/>
          <rect x="0" y="240" width="800" height="360" ${paint('--flesh-2', null, 0, 'opacity:.55')}/>
          ${caps}
          <g id="epi">${epi.join('')}</g>
          <path d="M560,240 L580,90" ${paint(null, '--ink-2', 4, 'stroke-linecap:round')}/>
          <g id="wnd"></g>
          ${label(20, 140, 'Epidermis', { anchor: 'start', color: '--ink' })}
          ${label(20, 290, 'Dermis', { anchor: 'start', color: '--ink' })}
          ${label(780, 590, 'Capillary loops', { anchor: 'end', color: '--on-blood' })}
          <text id="skstate" x="400" y="60" text-anchor="middle" class="svg-note" style="font-size:19px;fill:var(--ink);font-weight:700"></text>`;
      },
      live(c) {
        const s = c.s;
        const ph = woundPhase(s);
        const gap = ph ? 160 * (1 - ph.heal) : 0;
        c.root.querySelectorAll('.epi').forEach(el => { el.style.opacity = Math.abs(+el.dataset.x - 400) < gap / 2 ? 0 : 1; });
        const L = s.infections.scrape ? s.infections.scrape.L : 0;
        const I = s.infections.scrape ? s.infections.scrape.I : 0;
        const key = ph ? `${ph.id}${Math.round(gap / 10)}${Math.round(L * 20)}${Math.round(I * 8)}` : 'none';
        const w = c.q('#wnd');
        if (w.dataset.k !== key) {
          w.dataset.k = key;
          let h = '';
          if (ph) {
            const r = rng(13);
            const x0 = 400 - gap / 2;
            if (ph.id === 'bleeding') h += `<rect x="${x0}" y="120" width="${gap}" height="130" rx="20" ${paint('--blood-o2', null, 0, 'opacity:.85')}/>`;
            if (ph.id !== 'bleeding' && gap > 4) {
              h += `<rect x="${x0}" y="150" width="${gap}" height="90" ${paint('--blood-low', null, 0, 'opacity:.55')}/>`;
              h += Array.from({ length: 14 }, () => `<path d="M${x0 + r() * gap},${150 + r() * 90} L${x0 + r() * gap},${150 + r() * 90}" ${paint(null, '--fibrin', 2.5)}/>`).join('');
              if (ph.id !== 'clotting') h += `<path d="${blob(400, 140, gap / 2 + 8, 16, { seed: 3, wob: 0.2 })}" ${paint('--scab', '--ink', 1.5)}/>`;
            }
            h += Array.from({ length: Math.round(12 * (ph.id === 'bleeding' ? 1 : 0.5)) }, () => `<circle cx="${x0 + r() * gap}" cy="${170 + r() * 70}" r="4" ${paint('--platelet', null)}/>`).join('');
            h += Array.from({ length: Math.round(I * 9) }, () => `<circle cx="${330 + r() * 140}" cy="${260 + r() * 160}" r="15" ${paint('--wbc', '--imm', 2)}/>`).join('');
            h += Array.from({ length: Math.round(L * 40) }, () => `<rect x="${360 + r() * 80}" y="${180 + r() * 90}" width="18" height="8" rx="4" ${paint('--germ', '--ink', 1)}/>`).join('');
          }
          w.innerHTML = h;
        }
        const msg = !ph ? 'Healthy skin. Try "Catch a germ", then "Scraped knee".'
          : ph.id === 'bleeding' ? 'Bleeding: platelets rushing to plug the gap'
          : ph.id === 'clotting' ? 'Clotting: a mesh of fibrin traps blood cells'
          : ph.id === 'scab' ? (I > 0.2 ? 'Scab on top, white cells cleaning underneath' : 'Scab on top, new skin growing underneath')
          : 'New skin closing the gap from the edges';
        c.q('#skstate').textContent = msg;
      },
      hotspots: [
        { to: 'neutrophil', at: [400, 330], label: 'The cleaners: neutrophils', side: 'right', anchor: [560, 400] },
        { to: 'blood', at: [150, 400], label: 'Blood supply', side: 'left', anchor: [120, 470] },
      ],
    },
    now(s) {
      const ph = woundPhase(s);
      if (!ph) return 'Intact. The outer layer keeps flaking off and being replaced.';
      return `Healing the scrape: about ${Math.round(ph.heal * 100)}% closed.`;
    },
  });

  // ---------- Simulation ----------
  A.process({
    id: 'immunity', order: 30,
    init(s) {
      setDefault(s, 'infections', {});
      setDefault(s, 'immune', {});
      setDefault(s, 'vaccines', []);
      setDefault(s, 'wbc', 7.5);
      setDefault(s, 'vaxLocal', 0);
      setDefault(s, 'wound', null);
    },
    step(s, dt, ctx) {
      const h = dt / 3600;
      for (const [gid, f] of Object.entries(s.infections)) {
        const g = ctx.germs[gid];
        const mem = s.immune[gid];
        const hasMem = !!(mem && mem.memory);
        const sinceH = (s.t - f.at) / 3600;
        // Memory of a poorly matched strain helps less: blend between first-time and memory speeds.
        const m = hasMem ? (mem.match || 1) : 0;
        const delay = g.delay.first * (1 - m) + g.delay.memory * m;
        if (sinceH > delay) f.A += (g.gA.first * (1 - m) + g.gA.memory * m) * (1 - f.A) * h;
        const Atot = Math.min(1, f.A + (mem ? mem.A * (mem.match || 1) : 0));
        f.L += (g.r * f.L * (1 - f.L) - g.kI * f.I * f.L - g.kA * Atot * f.L) * h;
        f.I += (g.aI * f.L * (1 - f.I) - g.dI * f.I) * h;
        f.L = clamp(f.L, 0, 1); f.I = clamp(f.I, 0, 1); f.A = clamp(f.A, 0, 1);
        f.peakI = Math.max(f.peakI || 0, f.I);
        const day = Math.floor(sinceH / 24) + 1;
        if (g.systemic && !f.sick && f.I > 0.3) {
          f.sick = true;
          ctx.log(`Feeling ill on day ${day} of the flu: fever, aches, tired. That's mostly the innate immune system fighting.`, { sys: 'immunity', node: 'lymphNode' });
        }
        if (g.systemic && !f.abLogged && f.A > 0.3) {
          f.abLogged = true;
          ctx.log(`Day ${day}: antibodies against ${g.name.toLowerCase()} are pouring out of the lymph nodes.`, { sys: 'immunity', node: 'antibody' });
        }
        if (f.L < 1e-4 && sinceH > 6) {
          const learned = f.A > 0.2;
          if (learned) s.immune[gid] = Object.assign({}, mem, { memory: true, source: mem && mem.memory ? mem.source : 'infection', at: s.t, A: Math.max(mem ? mem.A : 0, f.A * 0.8), match: 1 });
          let msg;
          if (!g.systemic) msg = `The germs in the scrape are gone. Neutrophils and other fast defenders handled it${learned ? '' : ' without needing antibodies'}.`;
          else if (!f.sick) msg = `Fought off the flu without getting ill${hasMem ? ': memory cells recognised it and stopped it early' : ''}.`;
          else msg = `Beat the flu after ${Math.round(sinceH / 24)} days${f.peakI < 0.55 ? ', and it stayed fairly mild' : ''}. ${hasMem ? 'Memory helped.' : 'Memory cells will remember this flu.'}`;
          ctx.log(msg, { sys: 'immunity', node: g.systemic ? 'bCell' : 'skin' });
          delete s.infections[gid];
        }
      }
      for (const v of s.vaccines) {
        if (v.done) continue;
        const g = ctx.germs[v.germ];
        const mem = s.immune[v.germ];
        const days = (s.t - v.at) / 86400;
        if (days > 5) mem.A += 0.015 * Math.max(0, g.vaccine.target - mem.A) * h;
        if (days >= 10 && !mem.memory) {
          mem.memory = true;
          ctx.log(`Memory B and T cells for flu are ready, ${Math.floor(days)} days after the vaccine.`, { sys: 'immunity', node: 'germinalCenter' });
        }
        if (days >= 14) {
          v.done = true;
          ctx.log('Flu vaccine training is complete. Antibody levels will slowly fade, but memory cells stay.', { sys: 'immunity', node: 'antibody' });
        }
      }
      for (const m of Object.values(s.immune)) m.A *= Math.exp(-h * Math.LN2 / (120 * 24));
      s.vaxLocal = approach(s.vaxLocal, 0, dt, 86400);
      const sysI = Object.entries(s.infections).reduce((mx, [gid, f]) => ctx.germs[gid].systemic ? Math.max(mx, f.I) : mx, 0);
      s.fever = 2.6 * Math.max(0, sysI - 0.2) / 0.8;
      s.wbc = approach(s.wbc, 7.5 + 5 * maxI(s) + s.vaxLocal, dt, 4 * 3600);
      if (s.wound && s.t - s.wound.at > 7 * 86400) {
        s.wound = null;
        ctx.log('The scraped knee has healed. New skin has closed the gap.', { sys: 'immunity', node: 'skin' });
      }
    },
    happening(s) {
      const out = [];
      const f = s.infections.flu;
      if (f) {
        const day = Math.floor((s.t - f.at) / 86400) + 1;
        out.push({ text: f.A > 0.3 ? `Flu day ${day}: antibodies winning` : f.I > 0.3 ? `Flu day ${day}: fever, fighting hard` : `Flu day ${day}: virus copying itself, no symptoms yet`, node: f.A > 0.3 ? 'antibody' : 'lymphNode', sys: 'immunity' });
      }
      const w = woundPhase(s);
      if (w) out.push({ text: w.id === 'bleeding' ? 'Scrape: platelets plugging it' : s.infections.scrape ? 'Scrape: neutrophils cleaning up' : `Scrape healing: ${Math.round(w.heal * 100)}%`, node: 'skin', sys: 'immunity' });
      const v = training(s);
      if (v) out.push({ text: `Vaccine training: day ${Math.floor((s.t - v.at) / 86400) + 1} of about 14`, node: 'germinalCenter', sys: 'immunity' });
      if (s.vaxLocal > 0.4) out.push({ text: 'Arm a bit sore from the jab', node: 'lymphNode', sys: 'immunity' });
      return out;
    },
  });

  A.vital({
    id: 'wbc', order: 60, label: 'White cells', unit: 'k per µL',
    value: s => s.wbc,
    fmt: v => v.toFixed(1),
    status: v => v > 13.5 ? 'high' : 'ok',
    node: 'neutrophil',
  });

  A.action({
    id: 'germ', label: 'Catch a germ', key: 'g', icon: 'germ', watch: ['lymphNode', 'skin'],
    options: [
      { id: 'flu', label: 'Flu virus', detail: 'breathed in through the nose' },
      { id: 'scrape', label: 'Scraped knee', detail: 'skin bacteria get into a scrape' },
    ],
    run(s, ctx, opt) {
      const g = ctx.germs[opt] || ctx.germs.flu;
      if (s.infections[g.id]) return { tip: `${ctx.body.name} is already fighting this one.` };
      const mem = s.immune[g.id];
      const blocked = mem ? Math.min(0.9, mem.A * (mem.match || 1)) : 0;
      s.infections[g.id] = { at: s.t, L: g.L0 * (1 - blocked), I: 0, A: 0 };
      if (g.id === 'scrape') {
        s.wound = { at: s.t };
        ctx.log('Scraped a knee. Skin bacteria got into the gap.', { sys: 'immunity', node: 'skin' });
        return { watch: 'skin', tip: 'Watch the scrape: bleeding stops within minutes, then neutrophils arrive.' };
      }
      ctx.log(`Caught the flu. Virus landed in the nose and throat and started copying itself.${mem && mem.memory ? ' The immune system has been trained on flu before.' : ''}`, { sys: 'immunity', node: 'lymphNode' });
      return { suggestSpeed: 3600, watch: 'lymphNode', tip: 'An infection plays out over days. Time is sped up to 1 hour per second; watch the lymph nodes.' };
    },
  });

  A.action({
    id: 'vaccine', label: 'Vaccinate', key: 'v', icon: 'shield', watch: ['germinalCenter'],
    options: Object.values(A.germs).filter(g => g.vaccine).map(g => ({ id: g.id, label: g.vaccine.name, detail: 'inactivated, cannot cause flu' })),
    run(s, ctx, opt) {
      const g = ctx.germs[opt] || ctx.germs.flu;
      if (training(s)) return { tip: 'Already training on a vaccine. Give it about two weeks.' };
      const mem = s.immune[g.id] || { memory: false, A: 0, source: 'vaccine', at: s.t };
      // This season's vaccine may match the circulating virus well or poorly.
      mem.match = 0.1 + Math.random() * 0.9;
      if (!mem.memory) mem.source = 'vaccine';
      s.immune[g.id] = mem;
      s.vaccines.push({ germ: g.id, at: s.t, done: false });
      s.vaxLocal = 1;
      ctx.log(`Got the ${g.vaccine.name.toLowerCase()}. The arm may be a bit sore for a day: that's the immune system noticing it.`, { sys: 'immunity', node: 'germinalCenter' });
      return { suggestSpeed: 3600, watch: 'germinalCenter', tip: 'Training takes about two weeks. Time is sped up to 1 hour per second.' };
    },
  });
})(window.Atlas);
