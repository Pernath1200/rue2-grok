// Visual-iteration harness for the Grammar Tree ("screenshot loop"): runs the
// REAL renderSimpleTreeOverview() from js/app.js in Node with stubbed
// DOM/storage, rasterizes the resulting SVG with resvg, and writes
// /tmp/tree-fresh.png + /tmp/tree-seeded.png. Useful where a Playwright
// browser isn't available (e.g. sandboxes that block the browser download).
// Usage: node scratch/tree-shot.js
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const start = src.indexOf('function renderSimpleTreeOverview()');
const end = src.indexOf('// Quick placeholders', start);
if (start < 0 || end < 0) throw new Error('could not locate render function');
const fnSrc = src.slice(start, end);

const grammarTree = JSON.parse(fs.readFileSync(path.join(root, 'data/tree/tree.json'), 'utf8'));
const pilotMapping = JSON.parse(fs.readFileSync(path.join(root, 'data/tree/pilot_families_mapping.json'), 'utf8'));
const topics = JSON.parse(fs.readFileSync(path.join(root, 'topics.json'), 'utf8')).topics;

function renderState({ bankSize = 0, bestByTopic = {} }) {
  const container = { innerHTML: '', querySelectorAll: () => [] };
  const env = {
    document: { getElementById: (id) => (id === 'treeRootsVisual' ? container : null) },
    window: { location: { hash: '' } },
    grammarTree,
    pilotMapping,
    state: { topics },
    loadMemoryBank: () => Object.fromEntries(Array.from({ length: bankSize }, (_, i) => ['k' + i, {}])),
    getTopicCompletionMap: () => ({}),
    getLastBest: (id) => (bestByTopic[id] ? { last: null, best: bestByTopic[id] } : { last: null, best: null }),
    routeHash: () => {},
    setTimeout: () => {},
    console,
  };
  const keys = Object.keys(env);
  const fn = new Function(...keys, `${fnSrc}\nrenderSimpleTreeOverview();`);
  fn(...keys.map((k) => env[k]));
  return container.innerHTML;
}

function shoot(name, opts) {
  let svg = renderState(opts);
  svg = svg.replace('style="display:block; width:100%; height:auto;"', 'width="1280" height="1000"');
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1600 },
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Serif' },
  }).render().asPng();
  const out = `/tmp/tree-${name}.png`;
  fs.writeFileSync(out, png);
  console.log('wrote', out, `(${png.length} bytes)`);
}

// State 1: brand-new learner.
shoot('fresh', { bankSize: 0 });

// State 2: seeded — heavy practice volume (tapProgress ≈ 0.78), one fully
// mastered family (ripe knot + halo), partial progress on a couple of roots.
const best = {};
const fam = (pilotMapping.pilot_families || []).find((f) => f.id === 'modal_verbs') || pilotMapping.pilot_families[0];
(fam.current_topics || []).forEach((t) => { best[t.id] = [10, 10]; });
topics.filter((t) => t.root === 'verb_phrase').forEach((t) => { best[t.id] = best[t.id] || [8, 10]; });
topics.filter((t) => t.root === 'prepositions_particles').forEach((t) => { best[t.id] = [6, 10]; });
shoot('seeded', { bankSize: 60, bestByTopic: best });
