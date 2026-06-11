// Applies triaged question fixes to questions.json with verification:
// each fix asserts the current question text contains an expected fragment
// before mutating; any mismatch aborts the whole run.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'questions.json');

function apply(fixes) {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const log = [];
  for (const f of fixes) {
    const q = ((data[f.topic] || {})[f.setId] || { questions: [] }).questions[f.idx];
    if (!q) throw new Error(`not found: ${f.topic}/${f.setId}[${f.idx}]`);
    const text = q.question || q.prompt || '';
    if (!text.includes(f.expect)) throw new Error(`mismatch at ${f.topic}/${f.setId}[${f.idx}]: expected fragment "${f.expect}" in "${text.slice(0, 90)}"`);
    if (f.newQuestion) q.question = f.newQuestion;
    if (f.addAnswers) {
      q.answers = q.answers || [];
      for (const a of f.addAnswers) if (!q.answers.some(x => x.toLowerCase() === a.toLowerCase())) q.answers.push(a);
    }
    if (f.removeAnswers) {
      q.answers = (q.answers || []).filter(a => !f.removeAnswers.some(r => r.toLowerCase() === a.toLowerCase()));
    }
    if (f.setAnswers) q.answers = f.setAnswers;
    if (f.newExplanation) q.explanation = f.newExplanation;
    log.push(`${f.topic}[${f.idx}] ${f.newQuestion ? 'reworded' : ''}${f.addAnswers ? ' +[' + f.addAnswers + ']' : ''}${f.removeAnswers ? ' -[' + f.removeAnswers + ']' : ''}${f.setAnswers ? ' answers=[' + f.setAnswers + ']' : ''}`);
  }
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  log.forEach(l => console.log(l));
  console.log('applied', fixes.length, 'fixes');
}

module.exports = { apply };

if (require.main === module) {
  const fixes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  apply(fixes);
}
