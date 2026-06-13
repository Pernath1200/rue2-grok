/**
 * Adds a stable `id` to every intro section across all curriculum_*.json files
 * (and the legacy curriculum.json).
 *
 * Stable section ids are the anchor target for per-question "Review the lesson"
 * links (questions carry `intro_ref: "<section id>"`). Ids are slugged from the
 * section title once and then persisted, so later title edits don't silently
 * move the anchor.
 *
 * The id line is inserted directly into the raw text (not via JSON round-trip)
 * so the rest of each file's formatting is preserved byte-for-byte — the diff is
 * purely the added `id` lines. Idempotent: sections that already start with an
 * `id` are skipped.
 *
 * Run: node scripts/add_intro_section_ids.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function introSections(curriculum) {
  const intro = curriculum && curriculum.intro;
  if (Array.isArray(intro)) return intro;
  if (intro && Array.isArray(intro.sections)) return intro.sections;
  return [];
}

// Ordered, de-duplicated ids derived from section titles.
function computeIds(sections) {
  const used = new Set(sections.filter(s => s && s.id).map(s => s.id));
  return sections.map(s => {
    if (s && s.id) return s.id;
    const base = slugify(s && s.title);
    let id = base, n = 2;
    while (used.has(id)) id = base + '-' + (n++);
    used.add(id);
    return id;
  });
}

// Walks the raw text of the intro `sections` array and inserts an `id` line at
// the top of each section object, matching the existing indentation. String- and
// depth-aware so nested objects/arrays (e.g. diagrams) are never mistaken for
// sections. Returns the count of ids added (0 = file already done).
function processFile(file) {
  const full = path.join(ROOT, file);
  const raw = fs.readFileSync(full, 'utf8');
  const sections = introSections(JSON.parse(raw));
  if (!sections.length) return 0;
  const ids = computeIds(sections);

  // Re-run the walk, this time applying edits and returning the new text.
  const secKey = raw.indexOf('"sections"');
  let i = raw.indexOf('[', secKey) + 1;
  let depth = 0, inStr = false, esc = false, order = 0;
  const inserts = [];
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') {
      if (depth === 0) {
        let j = i + 1, nl = '';
        if (raw[j] === '\r') { nl += raw[j++]; }
        if (raw[j] === '\n') { nl += raw[j++]; }
        let indent = '';
        while (raw[j] === ' ') indent += raw[j++];
        const id = ids[order];
        if (id != null && raw.slice(j, j + 5) !== '"id":') {
          inserts.push({ pos: i + 1, text: nl + indent + '"id": ' + JSON.stringify(id) + ',' });
        }
        order++;
      }
      depth++;
    } else if (ch === '[') { depth++; }
    else if (ch === '}') { depth--; }
    else if (ch === ']') { if (depth === 0) break; depth--; }
  }
  if (!inserts.length) return 0;
  inserts.sort((a, b) => b.pos - a.pos);
  let out = raw;
  for (const ins of inserts) out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
  // Sanity: result must parse and be semantically identical except added ids.
  JSON.parse(out);
  fs.writeFileSync(full, out);
  return inserts.length;
}

const files = fs.readdirSync(ROOT).filter(f => /^curriculum(_.*)?\.json$/.test(f));
let total = 0;
files.forEach(f => {
  const added = processFile(f);
  total += added;
  if (added) console.log(`  ${f}: +${added} id(s)`);
});
console.log(`Done. Added ${total} section id(s) across ${files.length} curriculum file(s).`);
