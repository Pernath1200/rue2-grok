// Renders a topic's intro sections to a standalone HTML file using the app's
// REAL renderers (renderDiagram + renderIntroContentHtml) and the app's CSS,
// for visual review without a browser harness.
// Run: node --experimental-vm-modules scratch/intro-preview.js <curriculum_file.json> <out.html>
// (Requires: npx esbuild on js/curriculum.js+ui.js exports — done inline below.)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const curFile = process.argv[2];
const outFile = process.argv[3] || '/tmp/intro-preview.html';
if (!curFile) { console.error('usage: node scratch/intro-preview.js curriculum_x.json out.html'); process.exit(1); }

fs.writeFileSync('/tmp/preview-entry.mjs',
  `export { renderDiagram } from "${ROOT}/js/curriculum.js";\nexport { renderIntroContentHtml } from "${ROOT}/js/ui.js";\n`);
execSync(`npx esbuild /tmp/preview-entry.mjs --bundle --format=esm --outfile=/tmp/preview-renderers.mjs --log-level=error`, { cwd: ROOT });

(async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, appendChild() {} }), addEventListener: () => {}, body: { classList: { add() {}, remove() {} } } };
  globalThis.window = { location: { hash: '', protocol: 'https:' }, addEventListener: () => {} };
  const { renderDiagram, renderIntroContentHtml } = await import('/tmp/preview-renderers.mjs');

  const cur = JSON.parse(fs.readFileSync(path.join(ROOT, curFile), 'utf8'));
  const sections = (cur.intro && cur.intro.sections) || [];

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = (indexHtml.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

  let body = `<h1 style="font-size:1.2rem">${cur.intro.title || curFile} — intro preview (${sections.length} sections)</h1>`;
  sections.forEach((s, i) => {
    const diagrams = [].concat(s.diagrams || s.diagram || []).map(renderDiagram).join('');
    body += `<div class="card" style="max-width:600px;margin:0 auto 1.2rem;">`
      + `<div style="color:var(--muted);font-size:0.75rem">section ${i + 1}/${sections.length} · ${(s.content || '').length} prose chars · ${[].concat(s.diagrams || s.diagram || []).length} visuals</div>`
      + `<h3 style="color:var(--accent)">${s.title || ''}</h3>`
      + `<div class="intro-section">${renderIntroContentHtml(s.content || '')}</div>`
      + diagrams + `</div>`;
  });

  fs.writeFileSync(outFile,
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<style>${css}</style></head><body class="theme-cursor" style="padding:1rem">${body}</body></html>`);
  console.log('wrote', outFile, '(' + sections.length + ' sections)');
})();
