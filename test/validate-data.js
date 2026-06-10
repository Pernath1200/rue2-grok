/**
 * Data validation tests for rue2.cz content files.
 * Run: node test/validate-data.js
 *
 * Exit code 0 = all checks pass, 1 = failures found.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let passes = 0;

function fail(msg) { failures++; console.error('  FAIL: ' + msg); }
function pass(msg) { passes++; }

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function tryLoadJson(filePath, label) {
  try {
    return loadJson(filePath);
  } catch (e) {
    fail(label + ' is not valid JSON: ' + e.message);
    return null;
  }
}

// ── 1. Parse every JSON data file ──────────────────────────────────────────

console.log('\n1. JSON parse check');

const jsonFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json' && f !== 'audit_report.json');
const parsed = {};

for (const file of jsonFiles) {
  const data = tryLoadJson(path.join(ROOT, file), file);
  if (data !== null) {
    pass(file + ' parses OK');
    parsed[file] = data;
  }
}

const examDir = path.join(ROOT, '_exam_app');
const examRelocated = ['exam_open_cloze.json', 'exam_open_cloze_free.json', 'exam_word_formation.json', 'exam_sentence_transformation.json'];
for (const file of examRelocated) {
  const fp = path.join(examDir, file);
  if (!fs.existsSync(fp)) continue;
  const data = tryLoadJson(fp, '_exam_app/' + file);
  if (data !== null) {
    pass('_exam_app/' + file + ' parses OK');
    parsed[file] = data;
  }
}

// ── 2. topics.json integrity ───────────────────────────────────────────────

console.log('\n2. topics.json integrity');

const topicsData = parsed['topics.json'];
if (!topicsData) {
  fail('topics.json not loaded — skipping dependent checks');
} else {
  const topics = topicsData.topics || [];
  if (topics.length === 0) {
    fail('topics.json has no topics');
  } else {
    pass('topics.json has ' + topics.length + ' topics');
  }

  for (const t of topics) {
    if (!t.id) fail('Topic missing id: ' + JSON.stringify(t));
    if (!t.title) fail('Topic "' + t.id + '" missing title');
    if (!t.curriculum) fail('Topic "' + t.id + '" missing curriculum field');
    if (!t.questions_key) fail('Topic "' + t.id + '" missing questions_key');
  }
}

// ── 3. Every questions_key exists in questions.json ────────────────────────

console.log('\n3. questions_key → questions.json');

const questionsData = parsed['questions.json'];
if (!topicsData || !questionsData) {
  fail('Cannot check — topics.json or questions.json not loaded');
} else {
  for (const t of topicsData.topics) {
    const key = t.questions_key;
    if (!key) continue;
    if (questionsData[key]) {
      pass(key + ' found in questions.json');
    } else {
      fail('questions_key "' + key + '" (topic "' + t.id + '") not found in questions.json');
    }
  }
}

// ── 4. Every curriculum file exists on disk ────────────────────────────────

console.log('\n4. Curriculum files exist');

if (!topicsData) {
  fail('Cannot check — topics.json not loaded');
} else {
  for (const t of topicsData.topics) {
    const file = t.curriculum;
    if (!file) continue;
    if (fs.existsSync(path.join(ROOT, file))) {
      pass(file + ' exists');
    } else {
      fail('Curriculum file "' + file + '" (topic "' + t.id + '") not found on disk');
    }
  }
}

// ── 5. MC correct_option matches an option key ─────────────────────────────

console.log('\n5. MC correct_option validity');

function checkMCOptions(obj, source) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object') checkMCOptions(item, source);
    }
  } else if (obj && typeof obj === 'object') {
    if (obj.type === 'mc' && obj.options && obj.correct_option) {
      const validKeys = Object.keys(obj.options);
      if (validKeys.includes(obj.correct_option)) {
        pass('MC OK in ' + source);
      } else {
        const snippet = (obj.question || obj.stem || '').slice(0, 60);
        fail(source + ': correct_option "' + obj.correct_option + '" not in options [' + validKeys.join(',') + ']. Q: ' + snippet);
      }
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') checkMCOptions(v, source);
    }
  }
}

if (questionsData) checkMCOptions(questionsData, 'questions.json');

for (const file of jsonFiles) {
  if ((file.startsWith('curriculum_') || file.startsWith('exam_')) && parsed[file]) {
    checkMCOptions(parsed[file], file);
  }
}

// ── 6. topic_id values in exam/mixed files match a topics.json id ──────────

console.log('\n6. topic_id consistency');

if (!topicsData) {
  fail('Cannot check — topics.json not loaded');
} else {
  const validIds = new Set(topicsData.topics.map(t => t.id));
  const examFiles = ['exam_open_cloze.json', 'exam_open_cloze_free.json', 'exam_word_formation.json', 'exam_sentence_transformation.json', 'mixed_cloze.json'];

  for (const file of examFiles) {
    if (!parsed[file]) continue;
    const raw = JSON.stringify(parsed[file]);
    const matches = raw.match(/"topic_id"\s*:\s*"([^"]+)"/g) || [];
    const idsInFile = new Set();
    for (const m of matches) {
      const tid = m.match(/"topic_id"\s*:\s*"([^"]+)"/)[1];
      idsInFile.add(tid);
    }
    for (const tid of idsInFile) {
      if (validIds.has(tid)) {
        pass(file + ': topic_id "' + tid + '" is valid');
      } else {
        fail(file + ': topic_id "' + tid + '" not found in topics.json');
      }
    }
  }
}

// ── 7. root_content_index.json integrity (powers #practice/... deep links) ─

console.log('\n7. root_content_index.json integrity');

const rciPath = path.join(ROOT, 'data', 'tree', 'root_content_index.json');
const rci = fs.existsSync(rciPath) ? tryLoadJson(rciPath, 'data/tree/root_content_index.json') : null;
if (!rci || !topicsData) {
  fail('Cannot check — root_content_index.json or topics.json not loaded');
} else {
  const validIds = new Set(topicsData.topics.map(t => t.id));

  function checkIndexSection(sectionName, entries, deepLinkPrefix) {
    for (const key of Object.keys(entries || {})) {
      const entry = entries[key];
      for (const tid of entry.topics || []) {
        if (validIds.has(tid)) {
          pass(sectionName + '.' + key + ': topic "' + tid + '" is valid');
        } else {
          fail('root_content_index ' + sectionName + '.' + key + ': topic "' + tid + '" not found in topics.json');
        }
      }
      for (const ep of entry.practice_entry_points || []) {
        if (ep && ep.type === 'topic' && validIds.has(ep.id)) {
          pass(sectionName + '.' + key + ': entry point "' + ep.id + '" is valid');
        } else {
          fail('root_content_index ' + sectionName + '.' + key + ': entry point "' + (ep && ep.id) + '" invalid or not found in topics.json');
        }
      }
      if (entry.deep_link === deepLinkPrefix + key) {
        pass(sectionName + '.' + key + ': deep_link matches key');
      } else {
        fail('root_content_index ' + sectionName + '.' + key + ': deep_link "' + entry.deep_link + '" does not match expected "' + deepLinkPrefix + key + '"');
      }
    }
  }

  checkIndexSection('roots', rci.roots, '#practice/root/');
  checkIndexSection('pilot_families', rci.pilot_families, '#practice/root_id/');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log('\n────────────────────────────────');
console.log('Passed: ' + passes);
console.log('Failed: ' + failures);

if (failures > 0) {
  console.log('\nValidation FAILED with ' + failures + ' error(s).');
  process.exit(1);
} else {
  console.log('\nAll checks passed.');
  process.exit(0);
}
