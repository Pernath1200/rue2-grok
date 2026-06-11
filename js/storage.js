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

// === Spaced repetition (Leitner boxes) ===
//
// Every answered question is scheduled for review. Two tracks:
// - a wrong answer drops the item to box 0 (due tomorrow, then 1→3→7… days);
// - a right answer climbs a box, so known items resurface at ever longer
//   intervals. The top box recycles forever (nothing graduates out) — correct
//   answers keep coming back, just rarely.
// Entries written before scheduling existed are migrated lazily on first
// touch: ever-wrong items become due immediately; never-wrong items join the
// long track with their due dates staggered deterministically over the next
// three weeks, so day one isn't a flood.
export const REVIEW_INTERVAL_DAYS = [1, 1, 3, 7, 21, 60];
export const REVIEW_DAILY_CAP = 20;
const NEW_RIGHT_BOX = 3;          // first-ever answer correct → 7-day track
const MIGRATED_RIGHT_BOX = 4;     // legacy never-wrong entries → 21-day track
const DAY_MS = 24 * 60 * 60 * 1000;

function hashStaggerDays(key, maxDays) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h) + key.charCodeAt(i) | 0;
  return (Math.abs(h) % maxDays) + 1;
}

// Adds box/due to a pre-scheduling entry in place. Returns true if it changed.
function ensureReviewSchedule(entry, key) {
  if (entry.box != null && entry.due) return false;
  if ((entry.wrong || 0) > 0) {
    entry.box = 0;
    // Backdated a minute so "due immediately" can never lose a same-instant
    // comparison against a now captured a few ms earlier by the caller.
    entry.due = new Date(Date.now() - 60 * 1000).toISOString();
  } else {
    entry.box = MIGRATED_RIGHT_BOX;
    entry.due = new Date(Date.now() + hashStaggerDays(key, 21) * DAY_MS).toISOString();
  }
  return true;
}

export function saveMemoryBankEntry(key, correct) {
  const bank = loadMemoryBank();
  const isNew = !bank[key];
  if (isNew) bank[key] = { wrong: 0, right: 0, lastWrong: null };
  const entry = bank[key];
  if (correct) entry.right++; else { entry.wrong++; entry.lastWrong = new Date().toISOString(); }
  if (isNew) {
    entry.box = correct ? NEW_RIGHT_BOX : 0;
  } else {
    ensureReviewSchedule(entry, key);
    entry.box = correct ? Math.min(entry.box + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0;
  }
  entry.last = new Date().toISOString();
  entry.due = new Date(Date.now() + REVIEW_INTERVAL_DAYS[entry.box] * DAY_MS).toISOString();
  localStorage.setItem(MEMORY_KEY, JSON.stringify(bank));
}

// Questions due for review today, most overdue first (ties: most wrongs
// first), capped at `limit`. Scans every topic's questions so review crosses
// topic boundaries; requires state.allQuestionsData (loaded at startup).
export function getDueReviews(limit = REVIEW_DAILY_CAP) {
  const bank = loadMemoryBank();
  const now = Date.now();
  const due = [];
  const seen = new Set();
  let migrated = false;
  Object.values(state.allQuestionsData || {}).forEach(topicSets => {
    Object.values(topicSets || {}).forEach(s => {
      (s.questions || []).forEach(q => {
        const key = questionHash(q);
        if (seen.has(key)) return;
        const entry = bank[key];
        if (!entry) return;
        seen.add(key);
        if (ensureReviewSchedule(entry, key)) migrated = true;
        if (new Date(entry.due).getTime() <= now) due.push({ q, entry });
      });
    });
  });
  // Persist lazy migrations, otherwise staggered due dates would be
  // recomputed relative to "now" forever and never come due.
  if (migrated) localStorage.setItem(MEMORY_KEY, JSON.stringify(bank));
  due.sort((a, b) => {
    const d = new Date(a.entry.due) - new Date(b.entry.due);
    return d !== 0 ? d : (b.entry.wrong || 0) - (a.entry.wrong || 0);
  });
  return due.slice(0, limit).map(x => x.q);
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

// === Progress portability (export / import as a JSON file) ===
//
// A student's whole state is four localStorage keys: quiz history, the memory
// bank (incl. the spaced-repetition schedule), flagged questions and the theme.
// Import MERGES rather than replaces — the realistic case is a student who
// already practised a little on both devices. All merge rules are idempotent:
// importing the same file twice changes nothing.
export const THEME_KEY = 'rue2_theme';
export const PROGRESS_EXPORT_FORMAT = 'rue2-progress';

export function exportProgress() {
  const data = {};
  data[STORAGE_KEY] = loadScores();
  data[MEMORY_KEY] = loadMemoryBank();
  data[REPORTED_QUESTIONS_KEY] = getReportedQuestions();
  data[THEME_KEY] = localStorage.getItem(THEME_KEY) || null;
  return { format: PROGRESS_EXPORT_FORMAT, version: 1, exported: new Date().toISOString(), data };
}

export function importProgress(envelope) {
  if (!envelope || envelope.format !== PROGRESS_EXPORT_FORMAT || !envelope.data || typeof envelope.data !== 'object') {
    throw new Error('this is not a RUE2 progress file.');
  }
  const d = envelope.data;

  // Quiz history: union, deduplicated exactly by (set_id, date), date-sorted —
  // shared history can never double-count streaks or averages.
  const scores = loadScores();
  const imported = (d[STORAGE_KEY] && Array.isArray(d[STORAGE_KEY].history)) ? d[STORAGE_KEY].history : [];
  const seen = new Set(scores.history.map(e => e.set_id + '|' + e.date));
  let addedScores = 0;
  imported.forEach(e => {
    if (!e || !e.set_id || !e.date) return;
    const k = e.set_id + '|' + e.date;
    if (seen.has(k)) return;
    seen.add(k);
    scores.history.push(e);
    addedScores++;
  });
  scores.history.sort((a, b) => new Date(a.date) - new Date(b.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));

  // Memory bank: per question, keep the richer entry — more total answers,
  // ties broken by later activity. No summing, so no double-counting.
  const richness = e => (e.right || 0) + (e.wrong || 0);
  const lastTouch = e => Math.max(Date.parse(e.last || '') || 0, Date.parse(e.lastWrong || '') || 0, Date.parse(e.due || '') || 0);
  const bank = loadMemoryBank();
  const importedBank = (d[MEMORY_KEY] && typeof d[MEMORY_KEY] === 'object') ? d[MEMORY_KEY] : {};
  let updatedEntries = 0;
  Object.keys(importedBank).forEach(k => {
    const imp = importedBank[k];
    if (!imp || typeof imp !== 'object') return;
    const loc = bank[k];
    if (!loc || richness(imp) > richness(loc) ||
        (richness(imp) === richness(loc) && lastTouch(imp) > lastTouch(loc))) {
      bank[k] = imp;
      updatedEntries++;
    }
  });
  localStorage.setItem(MEMORY_KEY, JSON.stringify(bank));

  // Flagged questions: union, deduplicated by content.
  const reported = getReportedQuestions();
  const reportedSeen = new Set(reported.map(r => JSON.stringify(r)));
  (Array.isArray(d[REPORTED_QUESTIONS_KEY]) ? d[REPORTED_QUESTIONS_KEY] : []).forEach(r => {
    const k = JSON.stringify(r);
    if (reportedSeen.has(k)) return;
    reportedSeen.add(k);
    reported.push(r);
  });
  localStorage.setItem(REPORTED_QUESTIONS_KEY, JSON.stringify(reported));

  // Theme: the local choice wins if one was ever made.
  if (!localStorage.getItem(THEME_KEY) && typeof d[THEME_KEY] === 'string' && d[THEME_KEY]) {
    localStorage.setItem(THEME_KEY, d[THEME_KEY]);
  }

  return {
    addedScores,
    updatedEntries,
    totalScores: scores.history.length,
    totalTracked: Object.keys(bank).length
  };
}

export function questionHash(q) {
  const s = (q.question || q.prompt || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return (h >>> 0).toString(36);
}
