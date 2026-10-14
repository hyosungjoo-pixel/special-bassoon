/*
 * Pack: the whole body.
 * Owns the body silhouette, age-based normal values, activity (running, sleep),
 * breathing and temperature. Organs are added on top by other packs via Atlas.extend('body', ...).
 */
(function (A) {
  'use strict';
  const { setDefault, approach } = A.util;
  const { paint, label } = A.draw;

  // Typical values for a healthy child by age. Ranges overlap a lot between real kids.
  A.norms = function (body) {
    const a = Math.max(1, Math.min(18, Number(body && body.age) || 8));
    const weight = a <= 12 ? 2 * a + 8 : Math.round(3.5 * a - 10);
    const hrRest = a < 3 ? 110 : a < 6 ? 100 : a < 12 ? 85 : a < 16 ? 75 : 70;
    const brRest = a < 3 ? 28 : a < 6 ? 24 : a < 12 ? 20 : 16;
    return {
      age: a, weight,
      hrRest, hrMax: Math.round(208 - 0.7 * a), hrNormal: [hrRest - 15, hrRest + 30],
      brRest, brNormal: [brRest - 4, brRest + 6],
      bloodL: Math.round(weight * 0.075 * 10) / 10,
      glucoseBase: 5.0,
    };
  };

  A.node({
    id: 'body', scale: 'body', name: 'Whole body',
    size: n => `About ${n.age <= 12 ? Math.round(80 + n.age * 6) : 160} cm tall`,
    kid: '{name} is made of about 30 trillion tiny living cells, all working right now. None of them can see, and none of them knows your name, but together they are you. Pick a glowing spot to go inside.',
    adult: `<p>An adult body has roughly <strong>30 trillion human cells</strong>. By count, about 84% of them are red blood cells, because those are small and very numerous. By mass, most of you is muscle and fat cells.</p>
      <p>The three systems here are one story. <em>Digestion</em> breaks food into molecules small enough to cross into the blood. <em>Circulation</em> carries those molecules, and oxygen, to every cell. <em>Immunity</em> guards both, because the gut and the blood are the two biggest roads a germ could use.</p>`,
    numbers: [
      { value: '≈ 30 trillion', what: 'human cells in an adult body', who: 'adult', src: 'Sender, Fuchs & Milo, PLoS Biology 2016' },
      { value: '≈ 38 trillion', what: 'bacteria living in and on an adult, mostly in the large intestine', who: 'adult', src: 'Same study. Roughly 1 : 1 with human cells' },
      { value: n => `≈ ${n.bloodL} L`, what: n => `blood in a ${n.weight} kg child (about 75 mL per kg)`, who: 'kid', src: 'Adults have about 5 L' },
    ],
    words: [
      ['Cell', 'The smallest living unit. Each one has its own job.'],
      ['Tissue', 'Many similar cells working together, like muscle or blood.'],
      ['Organ', 'Several tissues built into one part with a job, like the stomach.'],
      ['System', 'Organs that work together, like the digestive system.'],
    ],
    myths: [
      { myth: 'You have 10 times more bacteria than human cells.', truth: 'That figure was a rough 1970s guess. A careful 2016 count found about the same number of each, and one trip to the toilet can tip the balance.' },
    ],
    simplified: 'The levels on this screen (organ, tissue, cell, molecule) are a way to organise the body, not walls inside it. Organs are drawn in the right neighbourhood but not exactly to scale.',
    whys: [
      { q: 'Why can\'t I feel my cells?', a: 'They are too small. A typical cell is 10 to 20 micrometres across, and your touch sensors notice pressure spread over much larger patches of skin.' },
      { q: 'Why do I need to eat?', a: 'Every cell burns fuel all the time to stay alive, mostly sugars and fats, and uses building blocks to repair itself. Food is where both come from.' },
    ],
    art: {
      draw() {
        const limb = (pts, w) => {
          const d = 'M' + pts.map(p => p.join(',')).join(' L');
          return `<path d="${d}" ${paint(null, '--body-line', w + 5, 'stroke-linecap:round;stroke-linejoin:round')}/>` +
                 `<path d="${d}" ${paint(null, '--body', w, 'stroke-linecap:round;stroke-linejoin:round')}/>`;
        };
        const torso = A.draw.smooth([[400, 126], [456, 134], [480, 160], [470, 250], [462, 342], [400, 362], [338, 342], [330, 250], [320, 160], [344, 134]], true);
        return `
          <g class="sil">
            ${limb([[330, 152], [300, 242], [287, 330]], 30)}
            ${limb([[470, 152], [500, 242], [513, 330]], 30)}
            ${limb([[372, 340], [366, 460], [362, 572]], 40)}
            ${limb([[428, 340], [434, 460], [438, 572]], 40)}
            <path d="${torso}" ${paint('--body', '--body-line', 2.5)}/>
            <rect x="386" y="104" width="28" height="30" rx="10" ${paint('--body', null)}/>
            <circle cx="400" cy="66" r="44" ${paint('--body', '--body-line', 2.5)}/>
            <path d="M386,58 q4,-4 8,0 M406,58 q4,-4 8,0" ${paint(null, '--ink-2', 2.5, 'stroke-linecap:round')}/>
          </g>
          <g id="zzz" opacity="0">${label(470, 40, 'z z z', { size: 22, color: '--imm', anchor: 'start' })}</g>
          <g id="runlines" opacity="0">
            <path d="M318,470 h-34 M322,500 h-46 M318,530 h-30" ${paint(null, '--ink-2', 3, 'stroke-linecap:round')}/>
          </g>
          <circle id="feverglow" cx="400" cy="300" r="300" style="fill:url(#fever);opacity:0"/>
          <defs><radialGradient id="fever"><stop offset="0" style="stop-color:var(--hot);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--hot);stop-opacity:0"/></radialGradient></defs>`;
      },
      live(c) {
        const s = c.s;
        const asleep = s.t < s.asleepUntil;
        c.q('#zzz').setAttribute('opacity', asleep ? 0.6 + 0.4 * Math.sin(c.now / 500) : 0);
        c.q('#runlines').setAttribute('opacity', s.exertion > 0.2 ? s.exertion * (0.6 + 0.4 * Math.sin(c.now / 90)) : 0);
        c.q('#feverglow').style.opacity = Math.max(0, Math.min(1, (s.temp - 37.4) / 1.4));
      },
    },
    now(s, body, n) {
      if (s.t < s.asleepUntil) return `${body.name} is asleep. Heart and breathing have slowed down.`;
      if (s.exertion > 0.3) return `${body.name} is running. Muscles are asking for more oxygen and fuel.`;
      if (s.temp > 37.8) return `${body.name} has a fever of ${s.temp.toFixed(1)} °C. The immune system is turning up the heat.`;
      return `${body.name} is resting. Everything is ticking along quietly.`;
    },
  });

  // Activity, breathing, temperature.
  A.process({
    id: 'core', order: 10,
    init(s, n) {
      setDefault(s, 'exertion', 0);
      setDefault(s, 'runUntil', 0);
      setDefault(s, 'runLen', 0);
      setDefault(s, 'runPeak', 0);
      setDefault(s, 'asleepUntil', 0);
      setDefault(s, 'br', n.brRest);
      setDefault(s, 'temp', 36.9);
      setDefault(s, 'fever', 0);
    },
    step(s, dt, ctx) {
      const n = ctx.norms;
      const running = s.t < s.runUntil;
      const asleep = s.t < s.asleepUntil;
      const target = running ? 0.75 : 0;
      s.exertion = approach(s.exertion, target, dt, target > s.exertion ? 30 : 120);
      const brT = n.brRest * (asleep ? 0.8 : 1) + s.exertion * n.brRest * 1.4 + s.fever * 3;
      s.br = approach(s.br, brT, dt, 20);
      const tempT = 36.9 + s.exertion * 0.7 + s.fever - (asleep ? 0.3 : 0);
      s.temp = approach(s.temp, tempT, dt, 600);
      if (s._running && !running) {
        ctx.log(`Finished a ${Math.round(s.runLen / 60)}-minute run. Heart peaked at ${Math.round(s.runPeak)} beats a minute, then started settling.`, { sys: 'circulation', node: 'heart' });
      }
      if (s._asleep && !asleep) ctx.log('Woke up after a night\'s sleep.', { node: 'body' });
      s._running = running;
      s._asleep = asleep;
    },
    happening(s) {
      const out = [];
      if (s.t < s.runUntil) out.push({ text: `Running: ${Math.ceil((s.runUntil - s.t) / 60)} min left`, node: 'heart', sys: 'circulation' });
      else if (s.exertion > 0.1) out.push({ text: 'Catching breath after the run', node: 'heart', sys: 'circulation' });
      if (s.t < s.asleepUntil) out.push({ text: 'Asleep', node: 'body' });
      return out;
    },
  });

  A.vital({
    id: 'breathing', order: 20, label: 'Breathing', unit: 'per min',
    value: s => s.br,
    fmt: v => Math.round(v),
    status: (v, s, n) => v > n.brNormal[1] + 2 ? 'high' : 'ok',
  });

  A.vital({
    id: 'temp', order: 30, label: 'Temperature',
    unit: u => u.temp === 'F' ? '°F' : '°C',
    value: s => s.temp,
    fmt: (v, u) => u.temp === 'F' ? (v * 9 / 5 + 32).toFixed(1) : v.toFixed(1),
    status: v => v >= 38 ? 'high' : v >= 37.6 ? 'warm' : 'ok',
  });

  A.action({
    id: 'run', label: 'Run', key: 'r', icon: 'run', watch: ['heart', 'blood'],
    blocked: s => s.t < s.asleepUntil ? 'Asleep right now' : s.t < s.runUntil ? 'Already running' : null,
    run(s, ctx) {
      s.runUntil = s.t + 15 * 60;
      s.runLen = 15 * 60;
      s.runPeak = s.hr || 0;
      ctx.log('Started a 15-minute run.', { sys: 'circulation', node: 'heart' });
      return { tip: 'Watch the heart rate climb. Running muscles need much more oxygen.' };
    },
  });

  A.action({
    id: 'sleep', label: 'Sleep', key: 's', icon: 'moon', watch: ['body'],
    blocked: s => s.t < s.asleepUntil ? 'Already asleep' : s.t < s.runUntil ? 'Still running' : null,
    run(s, ctx) {
      s.asleepUntil = s.t + 9 * 3600;
      ctx.log('Went to sleep.', { node: 'body' });
      return { fastForwardUntil: s.asleepUntil, tip: 'Skipping through the night. The body keeps working while you sleep.' };
    },
  });
})(window.Atlas);
