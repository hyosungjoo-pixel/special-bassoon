# Inside Me

A living human body to explore with a child on the living-room TV. You narrate, they point, and every click zooms deeper: body → organ → tissue → cell → molecule.

It starts with **digestion, circulation and immunity as one connected story**: food is absorbed through the villi into the blood, the heart pumps it around, and the immune system guards both the gut and the blood.

## What's in it

- **18 places to zoom into.** Mouth, stomach, small intestine → villus → enterocyte → SGLT1 transporter, large intestine, heart → blood → red blood cell → hemoglobin, neutrophil, lymph node → germinal centre → B cell → antibody, and skin.
- **Two voices on every screen.** *Say it* is a sentence to read aloud to your child. *For you* is the real science underneath: real numbers (marked adult or child, with sources where they matter), words to use, a myth check, what the drawing simplified, and ready-made answers to "why?" questions.
- **A living simulation.** Run, eat (lunch, an apple, juice), sleep, catch a germ (flu or a scraped knee) or get a flu vaccine, and watch heart rate, breathing, blood sugar, temperature, stomach fullness and white cells respond. The drawings respond too: the heart beats at the current rate, food moves through the gut, lymph nodes swell, a scrape bleeds, clots, scabs and heals.
- **It's their body.** Give it a name and age (normal ranges follow the age). It keeps a journal of everything that happened, counts heartbeats, and remembers immunity: a first flu takes about a week, while after a vaccine the outcome depends on how well that season's vaccine matches.
- **A guided story**, "Where does lunch go?", walks through all three systems in 13 steps.
- **Ask your own "why?"** When it runs as a Claude artifact, Claude answers in the same two voices.
- **Made for a TV.** Large type, arrow-key and remote navigation, hotkeys (R run, E eat, S sleep, G germ, V vaccine, J journal, P pause, Esc zoom out), and dark and light themes. It also works on a phone.

## Honesty rules

- No myths. Blood is never shown or described as blue: blood low in oxygen is dark red. The myth checks deal with the common ones: blue blood, the 10:1 bacteria ratio, the "tennis court" gut, where the heart and stomach really sit, antibiotics for flu, and fever being the illness.
- Every number says whether it is for an adult or a child. Uncertain numbers are flagged as estimates.
- Every screen says what it simplified. The simulator is a small model tuned to typical values for a healthy child. It is for learning, not medical advice.

## Running it

Open `index.html` in a browser, or serve the folder with any static server (`python3 -m http.server`). There is no build step. When it runs outside Claude, bodies are saved in the browser's local storage. As a Claude artifact, they are saved to the viewer's own account.

## Adding a topic

Everything is a **pack**: one script file that registers content with the engine. The engine and app know no anatomy. To add a topic, create `packs/<topic>.js` and add one `<script>` tag to `index.html` before `app.js`.

```js
(function (A) {
  A.system({ id: 'respiration', name: 'Breathing', color: '--water' });

  // A new organ, reachable from the body.
  A.node({
    id: 'lungs', parent: 'body', scale: 'organ', name: 'Lungs', systems: ['respiration'],
    size: () => 'About 25 cm tall in an adult',
    kid: '{name} breathes about 20 times a minute...',
    adult: '<p>The real science...</p>',
    numbers: [{ value: '≈ 300 million', what: 'alveoli in two adult lungs', who: 'adult', src: '...' }],
    words: [['Alveolus', 'A tiny air sac where oxygen enters the blood.']],
    myths: [{ myth: '...', truth: '...' }],
    simplified: 'What the drawing leaves out.',
    whys: [{ q: 'Why do I yawn?', a: '...' }],
    art: {
      draw: ctx => '<svg markup for an 800×600 viewBox>',
      live: c => { /* animate with c.s (state), c.dt, c.q(selector), c.mem */ },
      hotspots: [{ to: 'alveolus', at: [400, 300], label: 'Air sacs', side: 'right', anchor: [600, 300] }],
    },
    now: (s, body) => `Breathing ${Math.round(s.br)} times a minute.`,
  });

  // Put the lungs on the whole-body picture without touching the body pack.
  A.extend('body', { draw: () => '...', hotspots: [{ to: 'lungs', at: [380, 190], side: 'left', anchor: [190, 160] }] });

  // Join the simulation: init() only sets missing fields, so old saved bodies upgrade cleanly.
  A.process({ id: 'respiration', order: 25, init(s) { /* ... */ }, step(s, dt, ctx) { /* ... */ }, happening(s) { return []; } });
  A.vital({ id: 'spo2', label: 'Oxygen', unit: '%', value: s => s.spo2, fmt: v => Math.round(v), node: 'lungs' });
  A.action({ id: 'hold', label: 'Hold breath', key: 'h', run(s, ctx) { /* ... */ } });
})(window.Atlas);
```

Building blocks:

| Call | Adds |
| --- | --- |
| `Atlas.system` | A body system and its colour |
| `Atlas.node` | A zoomable place (any scale; push to `Atlas.SCALES` for new levels such as atoms or populations) |
| `Atlas.extend` | Layers, hotspots, numbers, myths or "why?"s on a node owned by another pack |
| `Atlas.process` | A piece of the simulation, stepped every 5 simulated seconds |
| `Atlas.vital` | A number in the top bar |
| `Atlas.action` | A button: something you can do to the body |
| `Atlas.germ` | A germ for the immune model, optionally with a vaccine |
| `Atlas.story` | A guided tour of steps (node, line to say, optional action) |
| `Atlas.norms` | Normal values by age; replace it to add babies, adults or old age |

Nodes carry a `species` field (default `human`), so other animals can arrive as packs with their own body node and norms.

## Files

- `engine.js`: registry, simulation runner, SVG drawing helpers
- `app.js`: rendering, zoom transitions, storage, keyboard and remote, journal, story mode
- `packs/body.js`: silhouette, age norms, activity, breathing, temperature
- `packs/digestion.js`, `packs/circulation.js`, `packs/immunity.js`: the three starting systems
- `packs/stories.js`: guided stories
