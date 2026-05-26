import state, { WEAK_SPOT_RIGHT_THRESHOLD } from './state.js';

export const STORAGE_KEY = 'grammarQuizScores';
export const MEMORY_KEY = 'grammarQuizMemory';
export const REPORTED_QUESTIONS_KEY = 'reportedQuestions';

export function migrateStorageKeys() {
  var oldKeys = [['presentPerfectQuizScores','grammarQuizScores'],['presentPerfectQuizMemory','grammarQuizMemory']];
  oldKeys.forEach(function(pair) {
    if (!localStorage.getItem(pair[1]) && localStorage.getItem(pair[0])) {
      localStorage.setItem(pair[1], localStorage.getItem(pair[0]));
      localStorage.removeItem(pair[0]);
    }
  });
}

export function loadScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { history: [] };
  } catch (e) { return { history: [] }; }
}

export function loadMemoryBank() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export function saveMemoryBankEntry(key, correct) {
  const bank = loadMemoryBank();
  if (!bank[key]) bank[key] = { wrong: 0, right: 0, lastWrong: null };
  if (correct) bank[key].right++; else { bank[key].wrong++; bank[key].lastWrong = new Date().toISOString(); }
  localStorage.setItem(MEMORY_KEY, JSON.stringify(bank));
}

export function saveScore(setId, setTitle, score, total) {
  const data = loadScores();
  data.history.push({ set_id: setId, set_title: setTitle, score, total, date: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getLastBest(setId) {
  const data = loadScores();
  const forSet = (data.history || []).filter(e => e.set_id === setId);
  if (!forSet.length) return { last: null, best: null };
  const last = forSet[forSet.length - 1];
  const best = forSet.reduce((acc, e) => {
    if (!acc || (e.score / e.total) > (acc.score / acc.total)) return e;
    return acc;
  }, null);
  return { last: [last.score, last.total], best: [best.score, best.total] };
}

export function getProgressStats() {
  const data = loadScores();
  const history = data.history || [];
  const total = history.length;
  if (total === 0) return { total: 0, avg: 0, thisWeek: 0, streak: 0 };
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = history.filter(e => new Date(e.date) >= weekAgo).length;
  let totalCorrect = 0, totalQuestions = 0;
  history.forEach(e => { totalCorrect += e.score; totalQuestions += e.total; });
  const avg = totalQuestions ? Math.round((100 * totalCorrect) / totalQuestions) : 0;
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const pct = (100 * history[i].score) / history[i].total;
    if (pct >= 80) streak++; else break;
  }
  return { total, avg, thisWeek, streak };
}

export function getTopicCompletionMap() {
  var data = loadScores();
  var history = data.history || [];
  var map = {};
  history.forEach(function(e) { map[e.set_id] = true; });
  return map;
}

export function getWeakSpotQuestions() {
  const bank = loadMemoryBank();
  const seen = new Set();
  const out = [];
  Object.values(state.setsData).forEach(s => {
    (s.questions || []).forEach(q => {
      const key = questionHash(q);
      const entry = bank[key];
      if (entry && entry.wrong > 0 && (entry.right || 0) < WEAK_SPOT_RIGHT_THRESHOLD && !seen.has(key)) {
        seen.add(key);
        out.push(q);
      }
    });
  });
  return out;
}

export function getReportedQuestions() {
  try { return JSON.parse(localStorage.getItem(REPORTED_QUESTIONS_KEY) || '[]'); } catch (e) { return []; }
}

export function questionHash(q) {
  const s = (q.question || q.prompt || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return (h >>> 0).toString(36);
}
