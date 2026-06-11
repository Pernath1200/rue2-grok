/**
 * Question audit script (read-only).
 * Cross-checks questions against reference data and produces audit_report.json + audit_report.md.
 * Run: node audit_questions.js
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OUT_JSON = path.join(DIR, 'audit_report.json');
const OUT_MD = path.join(DIR, 'audit_report.md');

// --- Load JSON ---
function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Failed to load ' + filePath + ': ' + e.message);
    return null;
  }
}

// --- Build reference maps ---

/** From reference_dependent_prepositions: phrase key (word before gap) -> list of allowed preposition answers */
function buildPrepositionsRefMap(ref) {
  const map = {};
  const sections = ['dependent_verbs', 'dependent_nouns', 'dependent_adjectives'];
  for (const section of sections) {
    const arr = ref[section];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const phrase = (entry.phrase || '').trim();
      if (!phrase) continue;
      const parts = phrase.split(/\s+/);
      const lastPart = parts[parts.length - 1];
      const preps = lastPart.split(/\s*\/\s*/).map(p => p.trim().toLowerCase()).filter(Boolean);
      const key = parts[0].toLowerCase();
      if (!map[key]) map[key] = [];
      for (const p of preps) {
        if (!map[key].includes(p)) map[key].push(p);
      }
    }
  }
  return map;
}

/** From reference_fixed_phrases: phrase pattern (e.g. "doing so") -> list of allowed first-word answers ["In","By"] */
function buildFixedPhrasesRefMap(ref) {
  const map = {};
  const phrases = ref.phrases || [];
  for (const entry of phrases) {
    const phrase = (entry.phrase || '').trim();
    if (!phrase) continue;
    if (phrase.indexOf(' / ') === -1) continue;
    const variants = phrase.split(/\s*\/\s*/).map(s => s.trim());
    const firstWords = variants.map(v => {
      const w = (v.split(/\s+/)[0] || v).trim();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
    const firstVariant = variants[0];
    const rest = firstVariant.split(/\s+/).slice(1).join(' ').toLowerCase();
    const key = rest || firstVariant.toLowerCase();
    map[key] = firstWords;
  }
  return map;
}

// --- Collect open questions from questions.json ---
function* iterQuestionsJson(data) {
  if (!data || typeof data !== 'object') return;
  for (const [topicKey, setData] of Object.entries(data)) {
    if (!setData || typeof setData !== 'object') continue;
    for (const [setId, set] of Object.entries(setData)) {
      const questions = set.questions || set;
      if (!Array.isArray(questions)) continue;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q && (q.question || q.prompt)) yield { source: 'questions.json', topicOrSet: topicKey, setId, questionIndex: i, q };
      }
    }
  }
}

// --- Collect questions from curriculum files ---
function* iterCurriculumQuestions() {
  const files = fs.readdirSync(DIR).filter(f => f.startsWith('curriculum_') && f.endsWith('.json'));
  for (const file of files) {
    const data = loadJson(path.join(DIR, file));
    if (!data) continue;
    const stack = [{ obj: data, path: file }];
    while (stack.length) {
      const { obj, path: p } = stack.pop();
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const item = obj[i];
          if (item && typeof item === 'object' && (item.question || item.prompt)) {
            yield { source: file, path: p, questionIndex: i, q: item };
          }
          if (item && typeof item === 'object') stack.push({ obj: item, path: p + '[' + i + ']' });
        }
      } else if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (v && typeof v === 'object') stack.push({ obj: v, path: p + '.' + k });
        }
      }
    }
  }
}

// --- Checks ---

/** Match word before gap: "research ____" or "research _____" */
function getWordBeforeGap(text) {
  const match = text.match(/\b(\w+)\s*_{2,}\s*/);
  return match ? match[1].toLowerCase() : null;
}

/** Check dependent prepositions: question in prepositions set, compare answers to reference */
function checkDependentPrepositions(report, prepositionsRefMap, data) {
  const prepositionsData = data.prepositions;
  if (!prepositionsData) return;
  for (const { topicOrSet, setId, questionIndex, q } of iterQuestionsJson(data)) {
    if (topicOrSet !== 'prepositions') continue;
    const questionText = (q.question || q.prompt || '').trim();
    if (!questionText.includes('____')) continue;
    const word = getWordBeforeGap(questionText);
    if (!word) continue;
    const allowed = prepositionsRefMap[word];
    if (!allowed || allowed.length <= 1) continue;
    const answers = (q.answers || []).map(a => String(a).trim().toLowerCase());
    const missing = allowed.filter(p => !answers.some(a => a === p));
    if (missing.length === 0) continue;
    report.missing_alternative.push({
      source: 'questions.json',
      topicOrSet,
      setId,
      questionIndex,
      check: 'missing_alternative',
      referencePhrase: word + ' ' + allowed.join(' / '),
      missing,
      questionSnippet: questionText.slice(0, 80) + (questionText.length > 80 ? '...' : ''),
    });
  }
}

/** Iterate only prepositions sets in questions.json */
function* iterPrepositionsQuestions(data) {
  const key = data.prepositions ? 'prepositions' : null;
  if (!key || !data[key]) return;
  for (const [setId, set] of Object.entries(data[key])) {
    const questions = set.questions || set;
    if (!Array.isArray(questions)) continue;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q && (q.question || q.prompt)) yield { topicOrSet: key, setId, questionIndex: i, q };
    }
  }
}

/** Fixed phrases: match "_____ doing so" or "7. _____ doing so, they saved" - return "doing so" */
function getFixedPhraseKey(text) {
  const m = text.match(/_{2,}\s+(\w+(?:\s+\w+)*)/);
  return m ? m[1].toLowerCase().trim() : null;
}

function checkFixedPhrases(report, fixedRefMap, data) {
  const fixedData = data.fixed_phrases;
  if (!fixedData) return;
  for (const { topicOrSet, setId, questionIndex, q } of iterQuestionsJson(data)) {
    if (topicOrSet !== 'fixed_phrases') continue;
    const questionText = (q.question || q.prompt || '').trim();
    const phraseKey = getFixedPhraseKey(questionText);
    if (!phraseKey) continue;
    const allowed = fixedRefMap[phraseKey];
    if (!allowed || allowed.length <= 1) continue;
    const answers = (q.answers || []).map(a => String(a).trim());
    const missing = allowed.filter(p => !answers.some(a => a === p || a.toLowerCase() === p.toLowerCase()));
    if (missing.length === 0) continue;
    report.missing_alternative_fixed.push({
      source: 'questions.json',
      topicOrSet,
      setId,
      questionIndex,
      check: 'missing_alternative_fixed',
      referencePhrase: phraseKey,
      missing,
      questionSnippet: questionText.slice(0, 80) + (questionText.length > 80 ? '...' : ''),
    });
  }
}

/** Recursively collect MC questions from an object */
function collectMCFromObj(obj, source, pathPrefix, out) {
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (item && typeof item === 'object') {
        if (item.type === 'mc' && item.options && item.correct_option) {
          out.push({
            source,
            path: pathPrefix + '[' + i + ']',
            index: i,
            check: 'mc_manual_check',
            correct_option: item.correct_option,
            options: item.options,
            questionSnippet: (item.question || '').slice(0, 60) + ((item.question || '').length > 60 ? '...' : ''),
          });
        }
        collectMCFromObj(item, source, pathPrefix + '[' + i + ']', out);
      }
    });
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') collectMCFromObj(v, source, pathPrefix + '.' + k, out);
    }
  }
}

/** MC list for manual check from all curriculum files */
function collectMC(report) {
  const list = [];
  const files = fs.readdirSync(DIR).filter(f => f.startsWith('curriculum_') && f.endsWith('.json'));
  for (const file of files) {
    const data = loadJson(path.join(DIR, file));
    if (data) collectMCFromObj(data, file, file, list);
  }
  const byFile = {};
  list.forEach(item => {
    if (!byFile[item.source]) byFile[item.source] = [];
    byFile[item.source].push(item);
  });
  report.mc_manual_check = byFile;
}

/** Heuristic: short or context-free open prompts */
function checkShortOrContextFree(report, data) {
  const hintWords = /past|yesterday|tomorrow|quantity|uncountable|countable|one word|e\.g\.|example|present|future|first|second|zero|conditional|much|many|some|few/i;
  // Topics whose items are inherently short but pinned by their cue, per the
  // 2026-06 triage of all 423 flags: prepositions/fixed_phrases (original),
  // prepositions_dependent (148 flags, fault rate of the targeted kind 1.4% —
  // its real faults were reference-list alternative gaps, not shortness),
  // phrasal_verbs (140 flags, 88% false positive — every item carries a
  // trailing "(gloss)" cue; real faults were variant-particle gaps), and
  // infinitive_ing/comparatives (the "(verb)"/"(adjective)" cue pins the
  // transformation). Deliberately NOT skipped despite their cues:
  // modal_verbs (7/15 genuine), quantifiers (4/4), irregular_verbs (9/12,
  // the verb cue does not pin the tense), relative_pronouns, reported_speech.
  const SKIP_TOPICS = new Set(['prepositions', 'fixed_phrases', 'prepositions_dependent', 'phrasal_verbs', 'infinitive_ing', 'comparatives']);
  for (const { source, topicOrSet, setId, questionIndex, q } of iterQuestionsJson(data)) {
    if (q.type === 'mc') continue;
    if (SKIP_TOPICS.has(topicOrSet)) continue;
    const questionText = (q.question || q.prompt || '').trim();
    if (questionText.length < 50 && questionText.includes('____') && !hintWords.test(questionText)) {
      report.short_or_context_free.push({
        source: 'questions.json',
        topicOrSet,
        setId,
        questionIndex,
        check: 'short_or_context_free',
        questionSnippet: questionText.slice(0, 100) + (questionText.length > 100 ? '...' : ''),
      });
    }
  }
}

/** Ambiguity: blank could have multiple valid answers without context */
const QUANTIFIER_ANSWERS = /^(all|most|some|none|no|few|little|half|any|many|much)$/i;
const DISAMBIG_PHRASES = /\(?(a small amount|a lot|almost none|positive|negative|a small number|almost nobody|whole group|offer|expect yes|quantity|one word|used up|leave|left angrily|left school)\)?|we only had|small slice|certain amount|Fill in the blank/i;
const TIME_CLUES = /yesterday|tomorrow|last year|last week|last month|last night|next week|when |while |every day|by Friday|already|by Shakespeare|by the storm|by the police|at the meeting|rang|knocked|went out|for months|so far|lately|this week|at 8 pm|at 9 pm|still work|for almost|since |all week|today|ago|just |never |yet|in 20|in 2019|next year|by 5|by next|for ages|for five|when the|when I|in 19|by the time|past|present|negative|deciding|habit|timetable|That evening|By 9|because she|before that|Third:|Second:|ever |expect yes|offer|possess|past negative|present negative|\(have = |\(deciding|I promise|I think|Look at those|The phone's ringing|three times|for you|I'm sure|in many countries|on the server|because I was|before the meeting|I realised|By 2020|before she got|there before|\(habit\)|when you called|when I arrived|since 2020|By next week|\(before\)|\(experience\)|when the phone|for five years|in 199|Fill in the auxiliary|wet\.|out of breath/i;
const TENSE_TOPICS = new Set(['passives', 'past_simple_continuous', 'past_simple_present_perfect', 'will_going_to', 'past_perfect', 'tenses_general', 'auxiliary_verbs', 'sets']);

function checkAmbiguity(report, data) {
  for (const { source, topicOrSet, setId, questionIndex, q } of iterQuestionsJson(data)) {
    if (q.type === 'mc') continue;
    const questionText = (q.question || q.prompt || '').trim();
    const answers = (q.answers || []).map(a => String(a).trim());
    const firstAnswer = answers[0] ? answers[0].toLowerCase() : '';

    // 1) Quantifier-style blank (_____ of the / _____ the) with no disambiguating context
    if (/_+\s*(of the|of |the \w+)/.test(questionText) && QUANTIFIER_ANSWERS.test(firstAnswer) && !DISAMBIG_PHRASES.test(questionText)) {
      report.ambiguity.push({
        source,
        topicOrSet,
        setId,
        questionIndex,
        check: 'ambiguity_quantifier',
        reason: 'Quantifier blank (all/most/some/none etc.) with no context to determine which.',
        questionSnippet: questionText.slice(0, 120),
        answer: firstAnswer,
      });
    }

    // 2) "_____ the X" or "_____ of" without "of the" but still quantifier answer and no context
    const questionNoTrailingParen = questionText.replace(/\s*\([^)]*\)\s*$/, '');
    if (/^\d*\.?\s*_{2,}\s+(the |of )/.test(questionNoTrailingParen)) {
      if (QUANTIFIER_ANSWERS.test(firstAnswer) && !DISAMBIG_PHRASES.test(questionText)) {
        const already = report.ambiguity.some(a => a.questionIndex === questionIndex && a.topicOrSet === topicOrSet && a.setId === setId);
        if (!already) {
          report.ambiguity.push({
            source,
            topicOrSet,
            setId,
            questionIndex,
            check: 'ambiguity_quantifier',
            reason: 'Quantifier blank with no context.',
            questionSnippet: questionText.slice(0, 120),
            answer: firstAnswer,
          });
        }
      }
    }

    // 3) Tense/verb blank with no time reference (only in tense-related topics; skip comparatives/infinitive_ing)
    if (TENSE_TOPICS.has(topicOrSet)) {
      const verbGap = questionText.match(/_{2,}\s*\([^)]*(?:\)|$)/);
      if (verbGap) {
        const beforeInstruction = questionText.split(/\s*Put the verb|\.\s*Put the verb|correct tense|correct form/i)[0] || questionText;
        if (!TIME_CLUES.test(questionText) && !TIME_CLUES.test(beforeInstruction)) {
          report.ambiguity.push({
            source,
            topicOrSet,
            setId,
            questionIndex,
            check: 'ambiguity_tense',
            reason: 'Verb tense blank with no time reference (past/present/future unclear).',
            questionSnippet: questionText.slice(0, 120),
            answer: firstAnswer,
          });
        }
      }
    }

    // 4) Short blank that could be several quantifiers/determiners: "We need _____ eggs", "Would you like _____ tea?"
    const needLikePattern = /(need|want|like)\s+_{2,}\s+\w+/i;
    if (needLikePattern.test(questionText) && questionText.length < 90) {
      const hasHint = /\([^)]*(?:number|amount|countable|uncountable|one word)[^)]*\)|Fill in the blank/i.test(questionText);
      if (!hasHint && (QUANTIFIER_ANSWERS.test(firstAnswer) || /^(some|any|a few|a little)$/i.test(firstAnswer))) {
        const already = report.ambiguity.some(a => a.questionIndex === questionIndex && a.topicOrSet === topicOrSet && a.setId === setId);
        if (!already) {
          report.ambiguity.push({
            source,
            topicOrSet,
            setId,
            questionIndex,
            check: 'ambiguity_need_like',
            reason: 'Need/like + blank could accept several answers without context.',
            questionSnippet: questionText.slice(0, 120),
            answer: firstAnswer,
          });
        }
      }
    }
  }
}

// --- Cross-file consistency checks ---

function checkOrphanedTopics(report, topicsData, questionsData) {
  if (!topicsData || !questionsData) return;
  var topics = topicsData.topics || [];
  for (var t of topics) {
    var key = t.questions_key || t.id;
    if (key === 'sets') continue;
    if (!questionsData[key]) {
      report.orphaned_topics.push({ id: t.id, questions_key: key, reason: 'questions_key "' + key + '" not found in questions.json' });
    }
  }
}

function checkMissingCurriculum(report, topicsData) {
  if (!topicsData) return;
  var topics = topicsData.topics || [];
  for (var t of topics) {
    var file = t.curriculum;
    if (!file) continue;
    if (!fs.existsSync(path.join(DIR, file))) {
      report.missing_curriculum.push({ id: t.id, curriculum: file });
    }
  }
}

function checkEmptyQuestionSets(report, questionsData) {
  if (!questionsData) return;
  for (var [topicKey, setData] of Object.entries(questionsData)) {
    if (!setData || typeof setData !== 'object') continue;
    for (var [setId, set] of Object.entries(setData)) {
      var qs = set.questions || (Array.isArray(set) ? set : []);
      if (qs.length === 0) {
        report.empty_sets.push({ topic: topicKey, set: setId });
      }
    }
  }
}

function checkDuplicateQuestions(report, questionsData) {
  if (!questionsData) return;
  for (var [topicKey, setData] of Object.entries(questionsData)) {
    if (!setData || typeof setData !== 'object') continue;
    var seen = {};
    for (var [setId, set] of Object.entries(setData)) {
      var qs = set.questions || (Array.isArray(set) ? set : []);
      for (var i = 0; i < qs.length; i++) {
        var text = (qs[i].question || qs[i].prompt || '').trim();
        if (!text) continue;
        var norm = text.replace(/\s+/g, ' ').toLowerCase();
        if (seen[norm]) {
          report.duplicate_questions.push({ topic: topicKey, set1: seen[norm], set2: setId + '[' + i + ']', snippet: text.slice(0, 80) });
        } else {
          seen[norm] = setId + '[' + i + ']';
        }
      }
    }
  }
}

function checkTopicIdConsistency(report, topicsData) {
  if (!topicsData) return;
  var validIds = new Set((topicsData.topics || []).map(function(t) { return t.id; }));
  var examFiles = ['exam_open_cloze.json', 'exam_open_cloze_free.json', 'exam_word_formation.json', 'exam_sentence_transformation.json', 'mixed_cloze.json'];
  for (var file of examFiles) {
    var fpExam = path.join(DIR, '_exam_app', file);
    var fpRoot = path.join(DIR, file);
    var fp = fs.existsSync(fpExam) ? fpExam : fpRoot;
    if (!fs.existsSync(fp)) continue;
    var data = loadJson(fp);
    if (!data) continue;
    var fileLabel = fp === fpExam ? '_exam_app/' + file : file;
    var ids = JSON.stringify(data).match(/"topic_id"\s*:\s*"([^"]+)"/g) || [];
    for (var m of ids) {
      var tid = m.match(/"topic_id"\s*:\s*"([^"]+)"/)[1];
      if (!validIds.has(tid)) {
        report.invalid_topic_ids.push({ file: fileLabel, topic_id: tid });
      }
    }
  }
  var seen = new Set();
  report.invalid_topic_ids = report.invalid_topic_ids.filter(function(i) {
    var key = i.file + ':' + i.topic_id;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// --- Main ---
function main() {
  const refDep = loadJson(path.join(DIR, 'reference_dependent_prepositions.json'));
  const refFixed = loadJson(path.join(DIR, 'reference_fixed_phrases.json'));
  const questionsData = loadJson(path.join(DIR, 'questions.json'));
  const topicsData = loadJson(path.join(DIR, 'topics.json'));

  const report = {
    missing_alternative: [],
    missing_alternative_fixed: [],
    mc_manual_check: [],
    short_or_context_free: [],
    ambiguity: [],
    orphaned_topics: [],
    missing_curriculum: [],
    empty_sets: [],
    duplicate_questions: [],
    invalid_topic_ids: [],
  };

  if (refDep) {
    const prepositionsRefMap = buildPrepositionsRefMap(refDep);
    if (questionsData) checkDependentPrepositions(report, prepositionsRefMap, questionsData);
  }

  if (refFixed && questionsData) {
    const fixedRefMap = buildFixedPhrasesRefMap(refFixed);
    checkFixedPhrases(report, fixedRefMap, questionsData);
  }

  if (questionsData) {
    checkShortOrContextFree(report, questionsData);
    checkAmbiguity(report, questionsData);
    // Dedupe ambiguity by location (keep first reason)
    const seen = new Set();
    report.ambiguity = report.ambiguity.filter((i) => {
      const key = `${i.topicOrSet}/${i.setId}/${i.questionIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  collectMC(report);

  checkOrphanedTopics(report, topicsData, questionsData);
  checkMissingCurriculum(report, topicsData);
  checkEmptyQuestionSets(report, questionsData);
  checkDuplicateQuestions(report, questionsData);
  checkTopicIdConsistency(report, topicsData);

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote ' + OUT_JSON);

  let md = '# Question audit report\n\n';
  md += '## 1. Missing alternatives (dependent prepositions)\n\n';
  if (report.missing_alternative.length === 0) md += 'None.\n\n';
  else report.missing_alternative.forEach(i => { md += `- **${i.source}** ${i.topicOrSet}/${i.setId} [#${i.questionIndex}]: ${i.referencePhrase} – missing: ${i.missing.join(', ')}. Snippet: ${i.questionSnippet}\n`; });
  md += '\n## 2. Missing alternatives (fixed phrases)\n\n';
  if (report.missing_alternative_fixed.length === 0) md += 'None.\n\n';
  else report.missing_alternative_fixed.forEach(i => { md += `- **${i.source}** ${i.topicOrSet}/${i.setId} [#${i.questionIndex}]: phrase "${i.referencePhrase}" – missing: ${i.missing.join(', ')}. Snippet: ${i.questionSnippet}\n`; });
  md += '\n## 3. MC list (manual check)\n\n';
  for (const [file, items] of Object.entries(report.mc_manual_check)) {
    md += `### ${file}\n\n`;
    items.forEach((i, idx) => {
      md += `- **#${idx}** correct_option: **${i.correct_option}** | ${i.questionSnippet}\n`;
      md += `  - a: ${(i.options.a || '').slice(0, 50)}${(i.options.a || '').length > 50 ? '...' : ''}\n`;
      md += `  - b: ${(i.options.b || '').slice(0, 50)}${(i.options.b || '').length > 50 ? '...' : ''}\n`;
      md += `  - c: ${(i.options.c || '').slice(0, 50)}${(i.options.c || '').length > 50 ? '...' : ''}\n`;
      md += `  - d: ${(i.options.d || '').slice(0, 50)}${(i.options.d || '').length > 50 ? '...' : ''}\n\n`;
    });
  }
  md += '\n## 4. Short or context-free open prompts (heuristic)\n\n';
  if (report.short_or_context_free.length === 0) md += 'None.\n\n';
  else report.short_or_context_free.forEach(i => { md += `- **${i.source}** ${i.topicOrSet}/${i.setId} [#${i.questionIndex}]: ${i.questionSnippet}\n`; });
  md += '\n## 5. Ambiguity (blank could be multiple answers without context)\n\n';
  if (report.ambiguity.length === 0) md += 'None.\n\n';
  else report.ambiguity.forEach(i => { md += `- **${i.source}** ${i.topicOrSet}/${i.setId} [#${i.questionIndex}] (${i.check}): ${i.reason}\n  - ${i.questionSnippet}\n  - Expected answer: ${i.answer}\n`; });

  md += '\n## 6. Orphaned topics (questions_key not in questions.json)\n\n';
  if (report.orphaned_topics.length === 0) md += 'None.\n\n';
  else report.orphaned_topics.forEach(i => { md += `- **${i.id}**: ${i.reason}\n`; });

  md += '\n## 7. Missing curriculum files\n\n';
  if (report.missing_curriculum.length === 0) md += 'None.\n\n';
  else report.missing_curriculum.forEach(i => { md += `- **${i.id}**: ${i.curriculum} not found on disk\n`; });

  md += '\n## 8. Empty question sets\n\n';
  if (report.empty_sets.length === 0) md += 'None.\n\n';
  else report.empty_sets.forEach(i => { md += `- **${i.topic}** / ${i.set}: 0 questions\n`; });

  md += '\n## 9. Duplicate questions (same text in one topic)\n\n';
  if (report.duplicate_questions.length === 0) md += 'None.\n\n';
  else report.duplicate_questions.forEach(i => { md += `- **${i.topic}**: ${i.set1} = ${i.set2} – "${i.snippet}"\n`; });

  md += '\n## 10. Invalid topic_id values in exam/mixed files\n\n';
  if (report.invalid_topic_ids.length === 0) md += 'None.\n\n';
  else report.invalid_topic_ids.forEach(i => { md += `- **${i.file}**: topic_id "${i.topic_id}" not in topics.json\n`; });

  fs.writeFileSync(OUT_MD, md, 'utf8');
  console.log('Wrote ' + OUT_MD);

  gateAgainstBaseline(report);
}

// --- Baseline ratchet ---
// The heuristic checks flag suspects, not certainties; every flag in
// audit_baseline.json has been human-triaged and accepted (false positive, or
// already accommodated via accepted alternatives). The audit FAILS (exit 1)
// only on flags that are not in the baseline — so CI guards against NEW
// ambiguous/faulty questions without re-litigating reviewed ones.
//
//   node audit_questions.js                  → gate against the baseline
//   node audit_questions.js --write-baseline → accept all current flags
//
// Structural checks (orphans, empty sets, duplicates, missing curricula,
// invalid topic ids) are never baselined: they always fail when non-empty.
const BASELINE_FILE = path.join(DIR, 'audit_baseline.json');
const BASELINED_CHECKS = ['missing_alternative', 'missing_alternative_fixed', 'short_or_context_free', 'ambiguity'];
const STRUCTURAL_CHECKS = ['orphaned_topics', 'missing_curriculum', 'empty_sets', 'duplicate_questions', 'invalid_topic_ids'];

function flagKey(bucket, item) {
  const text = (item.questionSnippet || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h) + text.charCodeAt(i) | 0;
  return bucket + '|' + (item.topicOrSet || '') + '|' + (h >>> 0).toString(36);
}

function gateAgainstBaseline(report) {
  const current = [];
  BASELINED_CHECKS.forEach(bucket => {
    (report[bucket] || []).forEach(item => current.push({ key: flagKey(bucket, item), bucket, item }));
  });

  if (process.argv.includes('--write-baseline')) {
    const baseline = {};
    current.forEach(({ key, item }) => { baseline[key] = (item.questionSnippet || '').slice(0, 80); });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 1), 'utf8');
    console.log('Wrote ' + BASELINE_FILE + ' (' + current.length + ' triaged flags accepted)');
    return;
  }

  let failed = false;

  STRUCTURAL_CHECKS.forEach(bucket => {
    const items = report[bucket] || [];
    if (items.length > 0) {
      failed = true;
      console.error('AUDIT FAIL: ' + bucket + ' has ' + items.length + ' finding(s) — see audit_report.md');
    }
  });

  let baseline = null;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch (e) {}
  if (!baseline) {
    console.warn('No audit_baseline.json — heuristic flags are not gated. Run with --write-baseline after triage.');
  } else {
    const fresh = current.filter(({ key }) => !(key in baseline));
    if (fresh.length > 0) {
      failed = true;
      console.error('AUDIT FAIL: ' + fresh.length + ' new heuristic flag(s) not in the triaged baseline:');
      fresh.forEach(({ bucket, item }) => {
        console.error('  [' + bucket + '] ' + (item.topicOrSet || '') + '/' + (item.setId || '') +
          ' #' + item.questionIndex + ': ' + (item.questionSnippet || '').slice(0, 90));
      });
      console.error('Fix the question(s), or triage and re-run with --write-baseline.');
    } else {
      const stale = Object.keys(baseline).filter(k => !current.some(c => c.key === k)).length;
      console.log('Audit gate: ' + current.length + ' known flags, 0 new' + (stale ? ' (' + stale + ' baseline entries no longer flagged — consider --write-baseline to prune)' : '') + '.');
    }
  }

  if (failed) process.exitCode = 1;
}

main();
