#!/usr/bin/env node
/**
 * add_contractions.js
 * 
 * Scans questions.json and adds missing contraction/full-form alternatives.
 * 
 * Usage:
 *   node add_contractions.js                  # dry run — shows what would change
 *   node add_contractions.js --apply          # writes changes to questions.json
 * 
 * Logic:
 *   For each answer that contains a full form (e.g. "have not seen"),
 *   if the contracted version ("haven't seen") is not already in the answers array,
 *   add it. Works in both directions (contracted → full) for key pairs.
 *   Also adds curly-apostrophe variants where straight apostrophe is present.
 */

const fs = require('fs');
const path = require('path');

const QUESTIONS_PATH = path.join(__dirname, 'questions.json');
const DRY_RUN = !process.argv.includes('--apply');

// ── Contraction pairs ──────────────────────────────────────────────
// [full form, contracted form]
// These are checked case-insensitively but inserted matching the original case.
const PAIRS = [
  // Negatives
  ["have not", "haven't"],
  ["has not", "hasn't"],
  ["had not", "hadn't"],
  ["do not", "don't"],
  ["does not", "doesn't"],
  ["did not", "didn't"],
  ["will not", "won't"],
  ["would not", "wouldn't"],
  ["could not", "couldn't"],
  ["should not", "shouldn't"],
  ["must not", "mustn't"],
  ["cannot", "can't"],
  ["is not", "isn't"],
  ["are not", "aren't"],
  ["was not", "wasn't"],
  ["were not", "weren't"],
];

// We intentionally do NOT auto-expand pronoun contractions like
// "I have" → "I've", "she is" → "she's", "they will" → "they'll"
// because these change the expected answer structure significantly
// and may not always be appropriate (e.g. at the start of an answer).
// Those should be reviewed manually.

// ── Helpers ─────────────────────────────────────────────────────────

function straightToCurly(s) {
  // Replace straight apostrophe with curly (right single quote)
  return s.replace(/'/g, '\u2019');
}

function curlyToStraight(s) {
  return s.replace(/\u2019/g, "'");
}

function answersSetNormalized(answers) {
  // Returns a Set of answers normalized: lowercased, curly→straight, trimmed
  const set = new Set();
  for (const a of answers) {
    set.add(curlyToStraight(a).toLowerCase().trim());
  }
  return set;
}

function matchCase(source, replacement) {
  // If source starts with uppercase, capitalize replacement
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// ── Main logic ──────────────────────────────────────────────────────

const data = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));

let totalAdded = 0;
let questionsAffected = 0;
const changes = [];

function processQuestions(questions, topicKey, setKey) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.answers || !Array.isArray(q.answers)) continue;

    const originalCount = q.answers.length;
    const existingNorm = answersSetNormalized(q.answers);
    const toAdd = [];

    for (const answer of [...q.answers]) { // iterate over copy
      const answerStraight = curlyToStraight(answer);
      const answerLower = answerStraight.toLowerCase();

      for (const [full, contracted] of PAIRS) {
        const fullLower = full.toLowerCase();
        const contractedLower = contracted.toLowerCase();

        // Check: answer contains full form → add contracted
        if (answerLower.includes(fullLower)) {
          const replacement = answerStraight.replace(
            new RegExp(full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
            (match) => matchCase(match, contracted)
          );
          const replacementNorm = replacement.toLowerCase().trim();

          if (!existingNorm.has(replacementNorm)) {
            toAdd.push(replacement);
            existingNorm.add(replacementNorm);

            // Also add curly apostrophe variant
            const curlyVariant = straightToCurly(replacement);
            const curlyNorm = curlyToStraight(curlyVariant).toLowerCase().trim();
            if (!existingNorm.has(curlyNorm) && curlyVariant !== replacement) {
              toAdd.push(curlyVariant);
              existingNorm.add(curlyNorm);
            }
          }
        }

        // Check: answer contains contracted form → add full form
        // (normalize curly apostrophes first)
        if (answerLower.includes(contractedLower)) {
          const replacement = answerStraight.replace(
            new RegExp(contracted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\\u2019]"), 'i'),
            (match) => {
              // Preserve case of first letter
              const firstChar = match[0];
              if (firstChar === firstChar.toUpperCase()) {
                return full[0].toUpperCase() + full.slice(1);
              }
              return full;
            }
          );
          const replacementNorm = curlyToStraight(replacement).toLowerCase().trim();

          if (!existingNorm.has(replacementNorm)) {
            toAdd.push(replacement);
            existingNorm.add(replacementNorm);
          }
        }
      }

      // Also: if answer has straight apostrophe, ensure curly variant exists
      if (answer.includes("'")) {
        const curly = straightToCurly(answer);
        const curlyNorm = curlyToStraight(curly).toLowerCase().trim();
        if (!existingNorm.has(curlyNorm) && curly !== answer) {
          // Don't add curly variant — it's redundant if the app normalizes.
          // But DO check if curly exists without straight.
        }
      }
    }

    if (toAdd.length > 0) {
      q.answers.push(...toAdd);
      questionsAffected++;
      totalAdded += toAdd.length;

      changes.push({
        topic: topicKey,
        set: setKey,
        idx: i,
        question: q.question.substring(0, 70),
        added: toAdd,
        finalAnswers: q.answers
      });
    }
  }
}

// Walk the data structure
for (const [topicKey, topicData] of Object.entries(data)) {
  if (typeof topicData !== 'object') continue;

  for (const [setKey, setData] of Object.entries(topicData)) {
    if (typeof setData === 'object' && setData !== null && Array.isArray(setData.questions)) {
      processQuestions(setData.questions, topicKey, setKey);
    }
  }
}

// ── Output ──────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(70)}`);
console.log(`CONTRACTION SWEEP ${DRY_RUN ? '(DRY RUN)' : '(APPLIED)'}`);
console.log(`${'='.repeat(70)}`);
console.log(`Questions affected: ${questionsAffected}`);
console.log(`Alternatives added: ${totalAdded}`);
console.log(`${'='.repeat(70)}\n`);

for (const c of changes) {
  console.log(`[${c.topic} / ${c.set}] Q${c.idx}`);
  console.log(`  "${c.question}..."`);
  console.log(`  Added: ${JSON.stringify(c.added)}`);
  console.log(`  Final: ${JSON.stringify(c.finalAnswers)}`);
  console.log();
}

if (!DRY_RUN) {
  fs.writeFileSync(QUESTIONS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅ Written to ${QUESTIONS_PATH}`);
} else {
  console.log(`ℹ️  Dry run — no changes written. Run with --apply to write.`);
}
