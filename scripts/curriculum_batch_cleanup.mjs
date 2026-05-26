/**
 * Batch cleanup for curriculum_*.json (see task spec).
 * Run: node scripts/curriculum_batch_cleanup.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const EXCLUDE = new Set([
  'curriculum_prepositions.json',
  'curriculum_infinitive_ing.json',
  'curriculum_word_order.json',
  'curriculum_conjunctions_linkers.json'
]);
const SKIP_PARSE = new Set(['curriculum_articles.json', 'curriculum_it_subject.json']);

const LINK_GLOB = /\[\[(reflinkers|ref|preplist)\|([^\]]+)\]\]/gi;

function isSummaryTitle(title) {
  const t = (title || '').trim();
  if (!t) return false;
  if (/summary\s+table/i.test(t)) return false;
  if (/^quick\s+summary/i.test(t)) return true;
  if (/^summary(\s|$|–|-|—|\()/i.test(t)) return true;
  return false;
}

function isRedundantReferenceIntroCard(title) {
  const t = (title || '').trim().toLowerCase();
  return t === 'reference list' || t === 'reference';
}

function stripReferenceLinks(content) {
  let c = content || '';
  c = c.replace(/\s*\[\[(?:reflinkers|ref|preplist)\|[^\]]+\]\]\s*/g, '\n');
  c = c.replace(/\n{3,}/g, '\n\n').trim();
  return c;
}

function removeNextPagePointer(content, nextHasDiagram) {
  let c = content || '';
  if (!nextHasDiagram) return c.trim();
  c = c.replace(/\n*\s*See the (?:reference table|diagram) on the next page\.?\s*$/i, '').trim();
  return c;
}

function mergeDuplicateTitles(sections) {
  const result = [];
  const keyToIndex = new Map();
  for (const s of sections) {
    const key = (s.title || '').trim();
    const entry = {
      title: s.title,
      content: s.content || '',
      ...(s.diagram ? { diagram: s.diagram } : {})
    };
    if (!keyToIndex.has(key)) {
      keyToIndex.set(key, result.length);
      result.push(entry);
    } else {
      const i = keyToIndex.get(key);
      const prev = result[i];
      const add = (s.content || '').trim();
      if (add) {
        const blocks = [...(prev.content || '').split(/\n\n+/), ...add.split(/\n\n+/)]
          .map((x) => x.trim())
          .filter(Boolean);
        prev.content = [...new Set(blocks)].join('\n\n');
      }
      if (!prev.diagram && s.diagram) prev.diagram = s.diagram;
    }
  }
  return result;
}

function splitParagraphs(text, maxLen) {
  if (!text || text.length <= maxLen) return [text];
  const paras = text.split(/\n\n+/);
  const chunks = [];
  let cur = '';
  function flush() {
    if (cur.trim()) chunks.push(cur.trim());
    cur = '';
  }
  for (const p of paras) {
    const combined = cur ? `${cur}\n\n${p}` : p;
    if (combined.length <= maxLen) {
      cur = combined;
      continue;
    }
    flush();
    if (p.length <= maxLen) {
      cur = p;
    } else {
      let start = 0;
      while (start < p.length) {
        let end = Math.min(start + maxLen, p.length);
        if (end < p.length) {
          const dot = p.lastIndexOf('. ', end);
          if (dot > start + 30) end = dot + 1;
        }
        chunks.push(p.slice(start, end).trim());
        start = end;
      }
    }
  }
  flush();
  return chunks.filter(Boolean);
}

function splitLongSections(sections, maxLen = 250) {
  const out = [];
  for (const s of sections) {
    if (s.diagram) {
      out.push(s);
      continue;
    }
    const t = s.content || '';
    if (t.length <= maxLen) {
      out.push(s);
      continue;
    }
    const base = (s.title || '').replace(/\s*\(\d+\)\s*$/, '').trim();
    const parts = splitParagraphs(t, maxLen);
    parts.forEach((part, idx) => {
      out.push({
        title: parts.length === 1 ? s.title : `${base} (${idx + 1})`,
        content: part
      });
    });
  }
  return out;
}

function buildFinalReferenceCard(linksMap) {
  const lines = [];
  if (linksMap.has('ref')) {
    const labels = [...linksMap.get('ref')];
    labels.forEach((lab) => lines.push(`[[ref|${lab}]]`));
  } else {
    lines.push('[[ref|Reference lists]]');
  }
  if (linksMap.has('preplist')) {
    [...linksMap.get('preplist')].forEach((lab) => lines.push(`[[preplist|${lab}]]`));
  }
  if (linksMap.has('reflinkers')) {
    [...linksMap.get('reflinkers')].forEach((lab) => lines.push(`[[reflinkers|${lab}]]`));
  }
  if (lines.length === 0) lines.push('[[ref|Reference lists]]');
  return lines.join('\n\n');
}

function collectLinksFromText(text, into) {
  const s = text || '';
  let m;
  const re = new RegExp(LINK_GLOB.source, 'gi');
  while ((m = re.exec(s)) !== null) {
    const kind = m[1].toLowerCase();
    const label = m[2];
    if (!into.has(kind)) into.set(kind, new Set());
    into.get(kind).add(label);
  }
}

function consolidateReferences(sections) {
  const globalLinks = new Map();
  for (const sec of sections) {
    collectLinksFromText(sec.content, globalLinks);
  }
  const processed = sections.map((s) => ({
    ...s,
    content: stripReferenceLinks(s.content)
  }));

  const filtered = processed.filter((s) => {
    if (s.diagram) return true;
    if (isRedundantReferenceIntroCard(s.title)) return false;
    return (s.content || '').trim().length > 0;
  });

  const refBody = buildFinalReferenceCard(globalLinks);
  const last = filtered[filtered.length - 1];
  if (last && (last.title || '').trim().toLowerCase() === 'reference' && !last.diagram) {
    last.content = [last.content, refBody].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  } else {
    filtered.push({ title: 'Reference', content: refBody });
  }
  return filtered;
}

function mcFingerprint(q) {
  if (!q || q.type !== 'mc') return null;
  const o = q.options || {};
  const vals = [o.a, o.b, o.c, o.d]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim().toLowerCase())
    .sort()
    .join('\u0001');
  return `${(q.question || '').trim().toLowerCase()}\u0000${vals}`;
}

function dedupeMc(curriculum) {
  const check = curriculum.check?.questions || [];
  const checkFp = new Set(check.filter((q) => q.type === 'mc').map(mcFingerprint).filter(Boolean));
  let removedInternal = 0;
  let removedCheck = 0;
  const block = curriculum.practice?.mc;
  if (!block || !Array.isArray(block.questions)) {
    return { removedInternal: 0, removedCheck: 0 };
  }
  const seen = new Set();
  const next = [];
  for (const q of block.questions) {
    if (q.type !== 'mc') {
      next.push(q);
      continue;
    }
    const fp = mcFingerprint(q);
    if (!fp) {
      next.push(q);
      continue;
    }
    if (seen.has(fp)) {
      removedInternal++;
      continue;
    }
    if (checkFp.has(fp)) {
      removedCheck++;
      continue;
    }
    seen.add(fp);
    next.push(q);
  }
  block.questions = next;
  return { removedInternal, removedCheck };
}

function processIntro(sections) {
  const stats = {
    removedSummary: 0,
    mergedTitles: 0,
    removedPointerOnly: 0,
    removedEmpty: 0,
    before: sections.length
  };

  let s = sections.filter((sec) => {
    if (isSummaryTitle(sec.title)) {
      stats.removedSummary++;
      return false;
    }
    return true;
  });

  const beforeMerge = s.length;
  s = mergeDuplicateTitles(s);
  stats.mergedTitles = beforeMerge - s.length;

  s = s.map((sec, i) => {
    const next = s[i + 1];
    const nextD = !!(next && next.diagram);
    const c = removeNextPagePointer(sec.content, nextD);
    return { ...sec, content: c };
  });

  s = s.filter((sec) => {
    if (sec.diagram) return true;
    const c = (sec.content || '').trim();
    if (!c) {
      stats.removedEmpty++;
      return false;
    }
    return true;
  });

  s = consolidateReferences(s);

  const beforeSplit = s.length;
  s = splitLongSections(s, 250);
  stats.afterSplit = s.length - beforeSplit;

  stats.after = s.length;
  return { sections: s, stats };
}

function processFile(filePath) {
  const name = path.basename(filePath);
  if (EXCLUDE.has(name) || SKIP_PARSE.has(name)) return null;

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { name, error: String(e.message) };
  }

  let curriculum;
  try {
    curriculum = JSON.parse(raw);
  } catch (e) {
    return { name, error: 'invalid JSON' };
  }

  if (!curriculum.intro || !Array.isArray(curriculum.intro.sections)) {
    return { name, skipped: 'no intro.sections' };
  }

  const introBefore = curriculum.intro.sections.length;
  const { sections, stats } = processIntro(JSON.parse(JSON.stringify(curriculum.intro.sections)));
  curriculum.intro.sections = sections;

  const mcStats = dedupeMc(curriculum);

  fs.writeFileSync(filePath, JSON.stringify(curriculum, null, 2) + '\n');

  return {
    name,
    introBefore,
    introAfter: sections.length,
    ...stats,
    mcRemovedInternal: mcStats.removedInternal,
    mcRemovedCheck: mcStats.removedCheck
  };
}

const files = fs
  .readdirSync(ROOT)
  .filter((f) => f.startsWith('curriculum_') && f.endsWith('.json'))
  .sort();

const reports = [];
for (const f of files) {
  const r = processFile(path.join(ROOT, f));
  if (r) reports.push(r);
}

console.log(JSON.stringify(reports, null, 2));
