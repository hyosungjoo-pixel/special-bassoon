/*
 * Pack: circulation.
 * Heart → blood → red blood cell → hemoglobin. Simulation: heart rate follows exercise,
 * sleep and fever; every beat is counted.
 */
(function (A) {
  'use strict';
  const { setDefault, approach } = A.util;
  const { paint, label, smooth, blob, rng, along, densify } = A.draw;

  A.system({ id: 'circulation', name: 'Circulation', color: '--circ' });

  // Heart squeeze: a quick contraction, then relaxation, once per beat.
  const beatShape = ph => { const u = ph % 1; return u < 0.15 ? Math.sin(u / 0.15 * Math.PI) : 0; };
  const HEART = 'M0,8 C0,-4 -16,-9 -20,3 C-24,14 -7,25 0,33 C7,25 24,14 20,3 C16,-9 0,-4 0,8Z';

  // ---------- Body overlay: heart and vessels ----------
  const ART = [[412, 172], [400, 150], [334, 160], [302, 244], [288, 322]];
  const ART2 = [[412, 172], [404, 150], [468, 160], [498, 244], [512, 322]];
  const ART3 = [[410, 190], [402, 260], [400, 336], [372, 356], [366, 460], [362, 560]];
  const ART4 = [[400, 336], [428, 356], [434, 460], [438, 560]];
  const shift = (pts, d) => pts.map(([x, y]) => [x + d, y + d * 0.5]);
  A.extend('body', {
    id: 'circulation', order: 10, systems: ['circulation'],
    draw() {
      const art = [ART, ART2, ART3, ART4].map(p => `<path class="flow" d="${smooth(p, false)}" ${paint(null, '--blood-o2', 3, 'stroke-dasharray:7 9;stroke-linecap:round')}/>`).join('');
      const vein = [ART, ART2, ART3, ART4].map(p => `<path class="flow-v" d="${smooth(shift(p, 6), false)}" ${paint(null, '--blood-low', 3, 'stroke-dasharray:7 9;stroke-linecap:round')}/>`).join('');
      return `<g opacity=".9">${vein}${art}</g>
        <path id="heart" d="${HEART}" transform="translate(412,168) rotate(-18) scale(1.15)" ${paint('--blood-o2', '--flesh-line', 1.5)}/>`;
    },
    live(c) {
      c.mem.beat = (c.mem.beat || 0) + c.dt * c.s.hr / 60;
      const k = 1.15 * (1 - 0.14 * beatShape(c.mem.beat));
      c.q('#heart').setAttribute('transform', `translate(412,168) rotate(-18) scale(${k.toFixed(3)})`);
      c.mem.flow = (c.mem.flow || 0) + c.dt * c.s.hr / 60 * 12;
      c.root.querySelectorAll('.flow').forEach(el => { el.style.strokeDashoffset = -c.mem.flow; });
      c.root.querySelectorAll('.flow-v').forEach(el => { el.style.strokeDashoffset = c.mem.flow; });
    },
    hotspots: [
      { to: 'heart', at: [412, 182], label: 'Heart', side: 'right', anchor: [610, 170] },
      { to: 'blood', at: [302, 244], label: 'Blood', side: 'left', anchor: [190, 224] },
    ],
  });

  // ---------- Heart ----------
  const P_BODY_IN = [[250, 20], [262, 120], [290, 200]];
  const P_R = [[290, 200], [320, 300], [340, 400], [360, 330], [350, 150], [330, 80], [250, 50], [150, 40]];
  const P_LUNG_IN = [[790, 200], [650, 195], [510, 195]];
  const P_L = [[510, 195], [480, 300], [460, 420], [450, 300], [440, 150], [470, 80], [560, 60], [660, 70], [700, 130]];
  const flowPaths = [[...P_BODY_IN, ...P_R.slice(1)], [...P_LUNG_IN, ...P_L.slice(1)]].map(p => densify(p, false, 6));
  A.node({
    id: 'heart', parent: 'body', scale: 'organ', name: 'Heart', systems: ['circulation'],
    size: () => 'About the size of your fist',
    kid: 'The heart is a muscle about the size of {name}\'s fist. It squeezes again and again, pushing blood out to the whole body and back. Right now it is beating {hr} times a minute.',
    adult: `<p>The heart is <strong>two pumps side by side</strong>. The right side receives blood that has given up oxygen to the body and sends it to the lungs. The left side receives oxygen-rich blood from the lungs and pumps it out to the body through the aorta. The left ventricle has the thickest wall because it pushes the farthest.</p>
      <p>Four one-way valves keep blood moving forward; the "lub-dub" you hear is valves snapping shut. A small patch of tissue called the <strong>sinoatrial node</strong> sets the rhythm by itself, and nerves and hormones such as adrenaline speed it up or slow it down. At rest an adult heart pumps about 5 litres a minute, roughly all of the body's blood once a minute. Hard exercise can raise that four- to five-fold.</p>`,
    numbers: [
      { value: '≈ 100,000', what: 'beats a day (at about 70 a minute)', who: 'any' },
      { value: n => `${n.hrNormal[0]}–${n.hrNormal[1]}`, what: n => `typical resting beats per minute for a ${n.age}-year-old. Adults: about 60–100`, who: 'kid' },
      { value: '≈ 5 L/min', what: 'blood pumped at rest', who: 'adult' },
      { value: '≈ 3 billion', what: 'beats in a long lifetime', who: 'any' },
    ],
    words: [['Atrium', 'An upper chamber that receives blood. Plural: atria.'], ['Ventricle', 'A lower chamber that pumps blood out.'], ['Valve', 'A one-way flap that stops blood flowing backwards.'], ['Aorta', 'The biggest artery, leaving the left ventricle.']],
    myths: [{ myth: 'Your heart is on the left side of your chest.', truth: 'It sits in the middle, behind the breastbone, with its tip pointing left. You feel the beat on the left because that is where the strong left ventricle taps against the chest wall.' }],
    simplified: 'The chambers are drawn as soft shapes and the lungs are left out. Here the low-oxygen blood is dark red and the high-oxygen blood is bright red, which is true to life.',
    whys: [
      { q: 'Why does my heart beat faster when I run?', a: 'Working muscles use oxygen much faster. Nerves and adrenaline tell the heart to beat faster and squeeze harder, so more blood (and oxygen) reaches them each minute.' },
      { q: 'Why doesn\'t my heart get tired?', a: 'Heart muscle cells are packed with mitochondria, the parts of a cell that release energy, and they make up about a third of each cell. The heart also relaxes between beats, and at rest that relaxing takes up about two-thirds of each beat.' },
    ],
    notYet: 'Heart muscle cells and the lungs',
    art: {
      draw() {
        return `
          <path d="M250,0 L262,120 L290,190" ${paint(null, '--blood-low', 40, 'stroke-linecap:round')}/>
          <path d="M270,600 L285,470 L300,380" ${paint(null, '--blood-low', 40, 'stroke-linecap:round')}/>
          <path d="M350,170 C340,90 280,60 140,50" ${paint(null, '--blood-low', 36, 'stroke-linecap:round')}/>
          <path d="M800,200 L560,195" ${paint(null, '--blood-o2', 32, 'stroke-linecap:round')}/>
          <path d="M440,170 C430,60 560,30 640,60 C690,80 705,110 705,160" ${paint(null, '--blood-o2', 44, 'stroke-linecap:round')}/>
          <g id="beat">
            <path d="${blob(400, 330, 250, 230, { seed: 31, wob: 0.05, n: 12 })}" ${paint('--flesh-2', '--flesh-line', 4)}/>
            <path d="${blob(290, 205, 80, 62, { seed: 5 })}" ${paint('--blood-low', null)}/>
            <path d="${blob(515, 195, 76, 58, { seed: 6 })}" ${paint('--blood-o2', null)}/>
            <g id="vent">
              <path d="${blob(330, 395, 92, 120, { seed: 7 })}" ${paint('--blood-low', null)}/>
              <path d="${blob(478, 400, 82, 128, { seed: 8 })}" ${paint('--blood-o2', null)}/>
            </g>
            <path d="M405,280 C412,360 410,450 400,530" ${paint(null, '--flesh-line', 22, 'stroke-linecap:round;opacity:.55')}/>
            <path d="M270,268 q30,14 60,0" ${paint(null, '--tooth', 5, 'stroke-linecap:round')}/>
            <path d="M485,262 q30,14 60,0" ${paint(null, '--tooth', 5, 'stroke-linecap:round')}/>
          </g>
          <g id="cells"></g>
          ${label(20, 30, 'From the body', { anchor: 'start', color: '--ink' })}
          ${label(20, 50, '(low oxygen, dark red)', { anchor: 'start', size: 13 })}
          ${label(120, 92, 'To the lungs', { anchor: 'start', color: '--ink' })}
          ${label(790, 240, 'From the lungs', { anchor: 'end', color: '--ink' })}
          ${label(790, 260, '(oxygen-rich, bright red)', { anchor: 'end', size: 13 })}
          ${label(705, 196, 'To the body', { anchor: 'middle', color: '--ink' })}
          ${label(330, 410, 'Right', { color: '--on-blood', size: 16 })}
          ${label(478, 410, 'Left', { color: '--on-blood', size: 16 })}
          ${label(400, 585, 'Valves (pale arcs) only open one way', { size: 14 })}`;
      },
      live(c) {
        c.mem.beat = (c.mem.beat || 0) + c.dt * c.s.hr / 60;
        const b = beatShape(c.mem.beat);
        c.q('#vent').setAttribute('transform', `translate(${400 * 0.1 * b},${420 * 0.1 * b}) scale(${1 - 0.1 * b})`);
        const g = c.q('#cells');
        if (!g.childElementCount) g.innerHTML = Array.from({ length: 16 }, (_, i) => `<circle r="7" ${paint(i % 2 ? '--blood-o2' : '--blood-low', '--ink', 1)}/>`).join('');
        c.mem.flow = (c.mem.flow || 0) + c.dt * c.s.hr / 60 * 0.06;
        [...g.children].forEach((el, i) => {
          const p = along(flowPaths[i % 2], c.mem.flow + Math.floor(i / 2) / 8);
          el.setAttribute('cx', p[0]); el.setAttribute('cy', p[1]);
        });
      },
      hotspots: [{ to: 'blood', at: [640, 60], label: 'The blood it pumps', side: 'right', anchor: [640, 125] }],
    },
    now: (s, body, n) => {
      const hr = Math.round(s.hr);
      if (hr > n.hrNormal[1] + 15) return `Racing at ${hr} beats a minute to keep up with ${body.name}'s muscles.`;
      return `Beating ${hr} times a minute. ${Math.round(s.beats).toLocaleString()} beats since Day 1.`;
    },
  });

  // ---------- Blood ----------
  A.node({
    id: 'blood', parent: 'heart', scale: 'tissue', name: 'Blood', systems: ['circulation', 'immunity'],
    size: () => 'This view is about 0.1 mm across',
    kid: 'Blood is a river full of cells. Red cells carry oxygen, white cells hunt germs, and tiny platelets plug leaks. Blood is always red: bright red when it carries lots of oxygen, darker red after it gives oxygen away.',
    adult: `<p>Blood counts as a tissue: cells floating in a liquid called <strong>plasma</strong>. By volume it is about 55% plasma (water carrying salts, proteins, hormones, glucose and waste) and about 45% cells, almost all of them red blood cells. Every blood cell is made in the <strong>bone marrow</strong>.</p>
      <p>It carries oxygen out from the lungs and carbon dioxide back, delivers the sugar that the gut absorbed, and is the highway that white blood cells use to reach an infection. Blood sugar is held in a narrow band (about 4–7 mmol/L when fasting) by insulin and the liver. In an adult, all the glucose circulating in the blood adds up to only about 4 grams, roughly a teaspoon.</p>`,
    numbers: [
      { value: '4–6 million', what: 'red blood cells in each microlitre (one tiny droplet, 1 mm³)', who: 'any' },
      { value: '4,500–13,500', what: 'white blood cells per microlitre, typical for school-age children', who: 'kid' },
      { value: '150,000–450,000', what: 'platelets per microlitre', who: 'any' },
      { value: '≈ 4 g', what: 'all the glucose in an adult\'s blood, about one teaspoon', who: 'adult', src: 'Wasserman, Am J Physiol Endocrinol Metab 2009' },
    ],
    words: [['Plasma', 'The pale yellow liquid part of blood.'], ['Platelet', 'A tiny cell fragment that helps blood clot.'], ['Bone marrow', 'Soft tissue inside bones where blood cells are made.']],
    myths: [
      { myth: 'Blood in your veins is blue until it touches air.', truth: 'Human blood is always red. Blood low in oxygen is dark red. Veins look bluish because skin scatters and absorbs light: blue light bounces back from shallow skin, while red light travels deeper and is absorbed by the blood.' },
      { myth: 'Your blood vessels would wrap 2.5 times around the Earth (100,000 km).', truth: 'That number is an old rough estimate, not a measurement, and some recent recalculations come out several times shorter. Either way it is a lot of tubing, and almost all of it is capillaries.' },
    ],
    simplified: 'We show far fewer cells than reality: a real droplet this size would be packed almost solid with red cells.',
    whys: [
      { q: 'Why is blood red?', a: 'Hemoglobin, the oxygen-carrying protein in red cells, contains iron held in a ring called heme. Heme absorbs blue and green light and reflects red. With oxygen attached it is bright red; without, darker red.' },
      { q: 'Why does a cut stop bleeding?', a: 'Platelets stick to the damaged spot within seconds and call more platelets. Then a protein mesh called fibrin traps red cells to make a clot, which dries into a scab.' },
    ],
    art: {
      draw() {
        const r = rng(17);
        const rbc = Array.from({ length: 36 }, () => {
          const x = r() * 900 - 50, y = 150 + r() * 300, rx = 22, ry = 10 + r() * 12, a = r() * 60 - 30;
          return `<g class="mv" data-x="${x}" data-y="${y}" data-a="${a}"><ellipse rx="${rx}" ry="${ry}" ${paint('--blood-o2', '--blood-low', 2)}/><ellipse rx="${rx * 0.45}" ry="${ry * 0.4}" ${paint('--blood-hi', null, 0, 'opacity:.6')}/></g>`;
        }).join('');
        const plt = Array.from({ length: 12 }, () => `<g class="mv" data-x="${r() * 900 - 50}" data-y="${160 + r() * 280}" data-a="${r() * 90}"><path d="${blob(0, 0, 7, 5, { seed: Math.floor(r() * 99), wob: 0.25, n: 6 })}" ${paint('--platelet', null)}/></g>`).join('');
        return `
          <rect x="0" y="0" width="800" height="600" ${paint('--flesh', null, 0, 'opacity:.5')}/>
          <rect x="0" y="110" width="800" height="380" ${paint('--plasma', null)}/>
          <path d="M0,110 H800 M0,490 H800" ${paint(null, '--flesh-2', 18)}/>
          <path d="M0,104 H800 M0,496 H800" ${paint(null, '--flesh-2', 6, 'stroke-dasharray:60 6')}/>
          <g id="moving">${rbc}${plt}<g id="wbcs"></g></g>
          <g transform="translate(250,300)"><ellipse rx="34" ry="16" ${paint('--blood-o2', '--ink', 3)}/><ellipse rx="15" ry="7" ${paint('--blood-hi', null, 0, 'opacity:.6')}/></g>
          <g id="roller" transform="translate(560,452)">
            <circle r="32" ${paint('--wbc', '--imm', 3)}/>
            <path d="M-14,-4 a7,7 0 1 1 10,6 a7,7 0 1 1 12,-2 a7,7 0 1 1 6,10" ${paint(null, '--nucleus', 7, 'stroke-linecap:round')}/>
          </g>
          ${label(20, 80, 'Vessel wall', { anchor: 'start' })}
          ${label(780, 80, 'Flow →', { anchor: 'end', color: '--ink' })}
          ${label(20, 540, 'Plasma: water with salt, sugar and proteins', { anchor: 'start' })}
          ${label(780, 540, 'Platelets: tiny, for plugging leaks', { anchor: 'end' })}`;
      },
      live(c) {
        const wbcN = Math.round(Math.max(2, c.s.wbc / 2.5));
        const w = c.q('#wbcs');
        if (w.childElementCount !== wbcN) {
          const r = rng(4);
          w.innerHTML = Array.from({ length: wbcN }, () => `<g class="mv" data-x="${r() * 900 - 50}" data-y="${170 + r() * 260}" data-a="0"><circle r="26" ${paint('--wbc', '--imm', 2)}/><circle r="11" ${paint('--nucleus', null, 0, 'opacity:.8')}/></g>`).join('');
        }
        c.mem.x = (c.mem.x || 0) + c.dt * c.s.hr * 1.4;
        c.root.querySelectorAll('.mv').forEach((el, i) => {
          const x = ((+el.dataset.x + c.mem.x * (0.8 + (i % 5) * 0.08)) % 900 + 900) % 900 - 50;
          el.setAttribute('transform', `translate(${x.toFixed(1)},${el.dataset.y}) rotate(${el.dataset.a})`);
        });
        c.mem.r = (c.mem.r || 0) + c.dt * 6;
        c.q('#roller').setAttribute('transform', `translate(${560 + Math.sin(c.mem.r / 20) * 12},452)`);
      },
      hotspots: [
        { to: 'rbc', at: [250, 300], label: 'A red blood cell', side: 'left', anchor: [200, 40] },
        { to: 'neutrophil', at: [560, 452], label: 'A white blood cell', side: 'right', anchor: [600, 575] },
      ],
    },
    now: (s, body) => `Blood sugar ${s.glucose.toFixed(1)} mmol/L. About ${(s.wbc * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} white cells in each microlitre.`,
  });

  // ---------- Red blood cell ----------
  const o2Cycle = now => (Math.sin(now / 1000 * Math.PI * 2 / 8) + 1) / 2; // 1 = fresh from the lungs
  A.node({
    id: 'rbc', parent: 'blood', scale: 'cell', name: 'Red blood cell', systems: ['circulation'],
    size: () => 'About 7.5 µm across, 2 µm thick',
    kid: 'A red blood cell is a squishy red disc. It is so small that a line of about 130 of them would only be one millimetre long. It got rid of its nucleus to make room for more oxygen carriers.',
    adult: `<p>A mature human red blood cell is a flexible <strong>biconcave disc</strong>: thinner in the middle, which gives more surface for gases to cross and lets it fold through capillaries narrower than itself. It has <strong>no nucleus and no mitochondria</strong>, so it can't divide or repair itself, and it doesn't use up the oxygen it carries; it runs on glycolysis instead.</p>
      <p>Each one is packed with about 270 million hemoglobin molecules. It lasts about 120 days, travelling round the body hundreds of thousands of times, before the spleen and liver recycle it and save its iron. To keep up, bone marrow makes about 2–3 million new ones every second.</p>`,
    numbers: [
      { value: '≈ 7.5 µm', what: 'across; capillaries can be narrower, about 5 µm', who: 'any' },
      { value: '≈ 120 days', what: 'lifespan', who: 'any' },
      { value: '2–3 million', what: 'new red cells made every second', who: 'adult' },
      { value: '≈ 25 trillion', what: 'red cells in an adult, the most common cell type by count', who: 'adult', src: 'Sender, Fuchs & Milo 2016' },
    ],
    words: [['Biconcave', 'Dished in on both sides, like a doughnut without a hole.'], ['Nucleus', 'The part of a cell that holds its DNA.'], ['Spleen', 'An organ that filters blood and removes old red cells.']],
    simplified: 'The colour change is real but drawn faster than life: each lap of the body takes about a minute at rest.',
    whys: [
      { q: 'Why are they shaped like that?', a: 'The dished shape gives lots of surface for oxygen to get in and out, and it bends easily so it can squeeze through tiny capillaries.' },
      { q: 'Where do old red cells go?', a: 'The spleen and liver take them out of the blood. The iron is saved and reused for new cells, and part of the rest becomes bilirubin, which gives bruises and poop some of their colour.' },
    ],
    art: {
      draw() {
        const side = smooth([[600, 150], [640, 160], [660, 210], [648, 300], [660, 390], [640, 440], [600, 450], [580, 400], [600, 300], [580, 200]], true);
        return `
          <defs><radialGradient id="rbcg"><stop offset="0" style="stop-color:var(--blood-hi)"/><stop offset=".55" id="rbcmid" style="stop-color:var(--blood-o2)"/><stop offset="1" style="stop-color:var(--blood-low)"/></radialGradient></defs>
          <circle id="disc" cx="300" cy="300" r="175" style="fill:url(#rbcg);stroke:var(--blood-low);stroke-width:4"/>
          <path id="side" d="${side}" ${paint('--blood-o2', '--blood-low', 4)}/>
          <path d="M120,520 H480" ${paint(null, '--ink', 3)}/><path d="M120,510 V530 M480,510 V530" ${paint(null, '--ink', 3)}/>
          ${label(300, 560, '≈ 7.5 µm', { color: '--ink', size: 18 })}
          ${label(620, 120, 'Side view', { color: '--ink' })}
          ${label(620, 490, '≈ 2 µm thick at the rim', { size: 14 })}
          <text id="o2state" x="300" y="60" text-anchor="middle" class="svg-note" style="font-size:20px;fill:var(--ink);font-weight:700"></text>`;
      },
      live(c) {
        const k = o2Cycle(c.now);
        const col = k > 0.5 ? 'var(--blood-o2)' : 'var(--blood-low)';
        c.q('#rbcmid').style.stopColor = col;
        c.q('#side').style.fill = col;
        c.q('#o2state').textContent = k > 0.5 ? 'Just left the lungs: full of oxygen, bright red' : 'Just passed a muscle: less oxygen, dark red';
      },
      hotspots: [{ to: 'hemoglobin', at: [300, 300], label: 'What\'s inside: hemoglobin', side: 'right', anchor: [470, 120] }],
    },
    now: s => s.exertion > 0.3 ? 'Racing round faster than usual and unloading more oxygen in the leg muscles.' : 'Doing laps: lungs, heart, body, heart, lungs.',
  });

  // ---------- Hemoglobin ----------
  A.node({
    id: 'hemoglobin', parent: 'rbc', scale: 'molecule', name: 'Hemoglobin', systems: ['circulation'],
    size: () => 'About 6 nm across',
    kid: 'Each red cell is stuffed with these. Hemoglobin has four parts, and each part holds one iron atom. Each iron can carry one oxygen molecule, so one hemoglobin carries up to four.',
    adult: `<p>Hemoglobin is four protein chains (two alpha and two beta). Each chain holds a <strong>heme</strong> group, a flat ring with an iron atom in the middle where one O₂ binds. Binding is <strong>cooperative</strong>: once one oxygen binds, the others bind more easily, and once one leaves, the rest leave more easily. That lets hemoglobin load fully in the lungs and unload readily in the tissues.</p>
      <p>Hemoglobin also gives up more oxygen where there is more carbon dioxide and acid, which is exactly what a working muscle produces (the <strong>Bohr effect</strong>). About two-thirds of the body's iron is in hemoglobin, which is why low iron can cause anaemia and tiredness.</p>`,
    numbers: [
      { value: '4', what: 'oxygen molecules carried per hemoglobin', who: 'any' },
      { value: '574', what: 'amino acids in its four chains (141 + 146, twice)', who: 'any' },
      { value: '≈ 270 million', what: 'hemoglobin molecules in one red cell', who: 'any' },
    ],
    words: [['Heme', 'The iron-holding ring that binds oxygen and makes blood red.'], ['Cooperative binding', 'Each oxygen that binds makes the next one bind more easily.'], ['Anaemia', 'Too little working hemoglobin. Often caused by low iron. Spelled anemia in the US.']],
    simplified: 'Shown as four soft blobs. Each chain is really a precisely folded string of amino acids, and the heme is buried in a pocket inside it.',
    whys: [{ q: 'Why is carbon monoxide dangerous?', a: 'It binds the iron in hemoglobin about 200 times more tightly than oxygen does, so hemoglobin can\'t carry oxygen. That is why homes have carbon monoxide alarms.' }],
    art: {
      draw() {
        const sub = [[320, 220, '--hb-a', 'α', 41], [480, 220, '--hb-b', 'β', 42], [480, 380, '--hb-a', 'α', 43], [320, 380, '--hb-b', 'β', 44]];
        return sub.map(([x, y, col, nm, seed], i) => `
          <path d="${blob(x, y, 105, 90, { seed, wob: 0.12, n: 9 })}" ${paint(col, '--ink', 2, 'opacity:.9')}/>
          <text x="${x + (x < 400 ? -60 : 60)}" y="${y + (y < 300 ? -40 : 55)}" text-anchor="middle" class="svg-note" style="font-size:30px;fill:var(--ink);font-weight:700">${nm}</text>
          <ellipse class="heme" cx="${x}" cy="${y}" rx="34" ry="12" ${paint('--blood-o2', '--ink', 1.5)}/>
          <circle cx="${x}" cy="${y}" r="9" ${paint('--iron', '--ink', 1.5)}/>
          <g class="o2" data-x="${x}" data-y="${y}" data-i="${i}"><circle cx="-9" r="9" ${paint('--o2', '--blood-o2', 2)}/><circle cx="9" r="9" ${paint('--o2', '--blood-o2', 2)}/></g>`).join('') + `
          ${label(400, 40, 'One hemoglobin molecule', { color: '--ink', size: 18 })}
          ${label(400, 585, 'Iron (orange) in each heme holds one oxygen (O₂, the pairs)', { size: 14 })}
          <text id="hbstate" x="790" y="300" text-anchor="end" class="svg-note" style="font-size:16px;fill:var(--ink-2);font-weight:600"></text>`;
      },
      live(c) {
        const k = o2Cycle(c.now);
        const bound = Math.round(1 + k * 3.4);
        c.root.querySelectorAll('.o2').forEach(el => {
          const i = +el.dataset.i, on = i < bound;
          const x = +el.dataset.x, y = +el.dataset.y;
          const dx = (x < 400 ? -1 : 1) * (on ? 0 : 90), dy = on ? -22 : (y < 300 ? -80 : 80);
          el.setAttribute('transform', `translate(${x + dx},${y + dy})`);
          el.style.opacity = on ? 1 : 0.35;
        });
        c.root.querySelectorAll('.heme').forEach((el, i) => { el.style.fill = i < bound ? 'var(--blood-o2)' : 'var(--blood-low)'; });
        c.q('#hbstate').textContent = k > 0.5 ? 'In the lungs' : 'In a muscle';
      },
    },
    now: s => s.exertion > 0.3 ? 'In working muscles, the extra acid and CO₂ make hemoglobin let go of more oxygen.' : 'Loading oxygen in the lungs, unloading it in the body, about once a minute.',
  });

  // ---------- Simulation ----------
  A.process({
    id: 'circulation', order: 40,
    init(s, n) {
      setDefault(s, 'hr', n.hrRest);
      setDefault(s, 'beats', 0);
    },
    step(s, dt, ctx) {
      const n = ctx.norms;
      const asleep = s.t < s.asleepUntil;
      const target = n.hrRest * (asleep ? 0.85 : 1) + s.exertion * (n.hrMax - n.hrRest) * 0.95 + Math.max(0, s.temp - 37.2) * 10;
      s.hr = approach(s.hr, target, dt, target > s.hr ? 20 : 60);
      s.beats += s.hr / 60 * dt;
      if (s.t < s.runUntil) s.runPeak = Math.max(s.runPeak || 0, s.hr);
    },
  });

  A.vital({
    id: 'heart', order: 10, label: 'Heart', unit: 'beats/min', pulse: true,
    value: s => s.hr,
    fmt: v => Math.round(v),
    status: (v, s, n) => v > n.hrNormal[1] ? 'high' : 'ok',
    node: 'heart',
  });
})(window.Atlas);
