const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'questions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const MAX = 20;

for (const [topicKey, topicData] of Object.entries(data)) {
  if (!topicData || typeof topicData !== 'object') continue;
  const sets = topicData;
  const allQuestions = Object.values(sets).flatMap(s => (s && s.questions) || []);
  const total = allQuestions.length;
  if (total <= MAX) continue;

  const firstSet = Object.values(sets)[0];
  const keep = allQuestions.slice(0, MAX);
  data[topicKey] = {
    set1: {
      title: (firstSet && firstSet.title) || topicKey.replace(/_/g, ' '),
      summary: (firstSet && firstSet.summary) || '',
      questions: keep
    }
  };
  console.log(topicKey + ': ' + total + ' -> ' + MAX);
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('Done. Reduced question sets to max ' + MAX + ' each.');
