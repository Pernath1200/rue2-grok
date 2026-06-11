import state from './state.js';
import { STORAGE_KEY, MEMORY_KEY, REPORTED_QUESTIONS_KEY, migrateStorageKeys, loadScores, loadMemoryBank, saveMemoryBankEntry, saveScore, getLastBest, getProgressStats, getTopicCompletionMap, getReportedQuestions, questionHash } from './storage.js';
import { DATA_VERSION, SCREEN_IDS, MENU_PANEL_IDS, showScreen, showMenuPanel, openOverlay, closeOverlay, escapeAndBold, normalize, toTitleCase, shuffleArray, getBaseUrl, fetchJSON, renderScoreChart } from './ui.js';
import { registerCallbacks as registerCurrCallbacks, renderDiagram, showIntroSection, showWritingTipsIntroSection, startWritingTipsQuiz, startCourseSection, advanceCourseToNext, startPart1, startPart2, startDiagnostic, startMixedPractice, getCourseIntroSections } from './curriculum.js';
import { registerCallbacks as registerQuizCallbacks, startQuiz, startWeakSpotsQuiz, hasValidTopicSelected, syncCurrentTopicFromDropdown, getTopicTitle, getTopicLabelForDisplay, addReportedQuestion, addReportedIntroCard, getReportedReasonLabel, renderReportedQuestionsList, escapeHtml, cleanQuestionDisplay, showQuestion, submitAnswer, nextQuestion, finishQuiz, retryWrong } from './quiz.js';
import { registerCallbacks as registerRefCallbacks, renderPrepositionsListContent, prepositionsListAsText, showPrepositionsList, hidePrepositionsList, renderPhrasalVerbsDictionaryContent, phrasalVerbsDictionaryAsText, showPhrasalVerbsDictionary, hidePhrasalVerbsDictionary, renderReferenceIndex, showReferenceIndexFromIntro, renderReferencePrepositionsContent, showReferencePrepositions, renderReferenceOpenClozeContent, showReferenceOpenCloze, showOpenClozeRefFromIntro, showFixedPhrasesRefFromIntro, showReportedSpeechRefFromIntro, showInfinitiveIngRefFromIntro, showConjunctionsLinkersRefFromIntro, renderReferenceWordFormationContent, showReferenceWordFormation, renderReferenceConjunctionsLinkersContent, showReferenceConjunctionsLinkers, renderReferenceReportedSpeechContent, showReferenceReportedSpeech, renderReferenceIrregularVerbsContent, showReferenceIrregularVerbs, renderReferenceFixedPhrasesContent, showReferenceFixedPhrases, renderReferenceDependentSection, showReferenceDependentSection, dependentPrepositionsSectionAsText, renderReferenceCountableUncountableContent, showReferenceCountableUncountable, countableUncountableAsText, renderReferencePhrasalVerbsContent, showReferencePhrasalVerbs, renderReferenceInfinitiveIngContent, referenceAsText, showReference, showReferenceInfinitiveIng, renderReferenceModalVerbsContent, showReferenceModalVerbs, hideReference, onReferenceBackClick } from './reference.js';

migrateStorageKeys();
const COURSE_ORDER = ['check', 'gapfill', 'errorcorrection', 'makesentence', 'makequestion'];

// === Minimal Navigation State Machine + History Stack ===
// Goal: Reliable Back everywhere + support for keyboard-first navigation with low cognitive load.
const NAV = {
  history: [], // Array of { type: 'screen' | 'panel', id: string, context?: string, params?: object }
  current: null,

  _pushCurrent() {
    if (this.current) {
      this.history.push({ ...this.current });
      // Keep history reasonable size
      if (this.history.length > 12) this.history.shift();
    }
  },

  navigate(target, params = {}) {
    const isFullScreen = SCREEN_IDS.includes(target);
    const id = target;

    this._pushCurrent();

    this.current = {
      type: isFullScreen ? 'screen' : 'panel',
      id,
      context: params.context || '',
      params: { ...params }
    };

    if (isFullScreen) {
      showScreen(id);
      document.body.classList.remove('viewing-reference', 'viewing-content');
    } else {
      showScreen('menuScreen');
      showMenuPanel(id);

      // Special case: the tree panel needs its SVG rendered after being shown
      if (id === 'menuTreeOverview' && typeof renderSimpleTreeOverview === 'function') {
        renderSimpleTreeOverview();
      }
    }

    if (typeof updateNavContext === 'function') {
      updateNavContext(this.current.context);
    }

    // Keep the global Back button hidden on the true home screen
    const backBtn = document.getElementById('navBackBtn');
    if (backBtn) {
      backBtn.style.display = (id === 'menuMain') ? 'none' : '';
    }
  },

  back() {
    if (this.history.length === 0) {
      this.navigate('menuMain');
      return;
    }

    const previous = this.history.pop();
    this.current = previous;

    if (previous.type === 'screen') {
      showScreen(previous.id);
    } else {
      showScreen('menuScreen');
      showMenuPanel(previous.id);
    }

    if (typeof updateNavContext === 'function') {
      updateNavContext(previous.context || '');
    }

    // Extra safety: if we just landed on the home screen via back, force-hide the Back button
    if (previous.id === 'menuMain') {
      const backBtn = document.getElementById('navBackBtn');
      if (backBtn) backBtn.style.display = 'none';
    }

    const backBtn = document.getElementById('navBackBtn');
    if (backBtn) backBtn.style.display = (this.history.length === 0) ? 'none' : '';
  },

  // Helper to mark the current state with better context
  setContext(context) {
    if (this.current) {
      this.current.context = context;
      if (typeof updateNavContext === 'function') {
        updateNavContext(context);
      }
    }
  }
};

/** Excluded from Choose Grammar Topic only; curriculum_*.json files stay in the repo. */
const EXCLUDED_TOPIC_MENU_IDS = new Set(['open_cloze', 'sentence_transformation', 'word_formation']);
function filterTopicsForMenu(topics) {
  return (topics || []).filter(function (t) { return t && !EXCLUDED_TOPIC_MENU_IDS.has(t.id); });
}

// Category definitions driven by the Tree Model root field on each topic.
// A topic appears under a category if its `root` or `secondary_root` matches
// any root listed here. Editing CATEGORY_DEFS is the only manual step when
// adding new categories; topic membership flows from topics.json automatically.
const CATEGORY_DEFS = [
  { key: 'verbs_tenses',      roots: ['verb_phrase'] },
  { key: 'nouns_determiners', roots: ['noun_phrase'] },
  { key: 'sentence_structure',roots: ['sentence_syntax', 'tap_root'] },
  { key: 'linking_clauses',   roots: ['clause_linking'] },
  { key: 'verb_patterns',     roots: ['verb_complementation'] },
  { key: 'prepositions',      roots: ['prepositions_particles'] },
  { key: 'extras',            roots: ['outside_roots'] }
];

/** Hide topic options outside the chosen category (empty cat = show all + placeholder). */
function applyCategoryToTopicOptions(cat) {
  const sel = document.getElementById('topicSelect');
  if (!sel) return;
  const def = CATEGORY_DEFS.find(d => d.key === cat);
  const roots = (def && def.roots) || [];
  const allowed = new Set();
  (state.topics || []).forEach(t => {
    if (roots.indexOf(t.root) !== -1 || (t.secondary_root && roots.indexOf(t.secondary_root) !== -1)) allowed.add(t.id);
  });
  let firstVisible = null;
  Array.from(sel.options).forEach(opt => {
    const topicId = opt.dataset.topicId || '';
    opt.hidden = !!cat && (!topicId || !allowed.has(topicId));
    if (!opt.hidden && firstVisible === null) firstVisible = opt;
  });
  if (firstVisible) {
    sel.value = firstVisible.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

const WEAK_SPOT_RIGHT_THRESHOLD = 3;
function getWeakSpotQuestions() {
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

function answerMatches(user, accepted) {
  const u = normalize(user);
  const uNoStop = u.replace(/\.\s*$/, '');
  if (u === '') {
    const noArticleValues = ['no article', '∅', 'nothing'];
    if (accepted.some(a => noArticleValues.includes(normalize(a)))) return true;
  }
  return accepted.some(a => {
    const n = normalize(a);
    return n === u || (uNoStop !== '' && n.replace(/\.\s*$/, '') === uNoStop);
  });
}

async function loadCurriculumData() {
  var data = await fetchJSON(state.currentTopic.curriculum, { noStore: true });
  state.courseCurriculum = data;
  return data;
}

async function loadQuestions() {
  state.allQuestionsData = await fetchJSON('questions.json');
  state.setsData = state.allQuestionsData[state.currentTopic.questions_key] || {};
}

function applyTopic() {
  state.setsData = state.allQuestionsData[state.currentTopic.questions_key] || {};
}

function renderMenu() {
  const summaryEl = document.getElementById('scoresSummary');
  const lastBest = getLastBest(state.currentTopic.id);
  if (lastBest.last) {
    summaryEl.textContent = 'Last: ' + lastBest.last[0] + '/' + lastBest.last[1] +
      (lastBest.best && (lastBest.best[0] !== lastBest.last[0] || lastBest.best[1] !== lastBest.last[1])
        ? '  •  Best: ' + lastBest.best[0] + '/' + lastBest.best[1] : '');
  } else {
    summaryEl.textContent = '';
  }

  const memEl = document.getElementById('memoryBankSummary');
  memEl.innerHTML = '';
  const stats = getProgressStats();
  const bank = loadMemoryBank();
  const bankKeys = Object.keys(bank);
  const weakCount = bankKeys.filter(k => bank[k].wrong > 0 && (bank[k].right || 0) < WEAK_SPOT_RIGHT_THRESHOLD).length;
  const strongCount = bankKeys.filter(k => (bank[k].right || 0) >= WEAK_SPOT_RIGHT_THRESHOLD && (bank[k].wrong || 0) === 0).length;
  const mediumCount = bankKeys.length - weakCount - strongCount;
  if (stats.total > 0 || bankKeys.length > 0) {
    let parts = [];
    if (stats.total > 0) {
      parts.push(stats.total + ' quiz' + (stats.total === 1 ? '' : 'zes') + ' completed');
      parts.push(stats.avg + '% average');
      if (stats.thisWeek > 0) parts.push(stats.thisWeek + ' this week');
      if (stats.streak > 0) parts.push(stats.streak + ' in a row \u226580%');
    }
    var memParts = [];
    if (strongCount > 0) memParts.push('<span style="color:var(--correct)">' + strongCount + ' strong</span>');
    if (mediumCount > 0) memParts.push('<span style="color:var(--accent)">' + mediumCount + ' learning</span>');
    if (weakCount > 0) memParts.push('<span style="color:var(--wrong)">' + weakCount + ' weak</span>');
    var memLine = memParts.length > 0 ? '<br>Memory bank: ' + memParts.join(' &middot; ') : '';
    memEl.innerHTML = '<h3>Your progress</h3><p>' + parts.join(' &middot; ') + memLine + '</p>';
  }

  showScreen('menuScreen');
  showMenuPanel('menuMain');
}

// === Hash router ===
// Consumes #topic/<id> (legacy) plus the #practice/... deep links described in
// data/tree/how_teacher_links_will_work.md, powered by root_content_index.json.
function routeHash() {
  const hash = window.location.hash || '';
  let m;
  if ((m = hash.match(/^#topic\/([^/]+)$/))) { routeTopic(decodeURIComponent(m[1]), false); return; }
  if ((m = hash.match(/^#practice\/root\/([^/]+)$/))) { routePracticeRoot(decodeURIComponent(m[1])); return; }
  if ((m = hash.match(/^#practice\/root_id\/(.+)$/))) { routePracticeRootId(decodeURIComponent(m[1])); return; }
  if ((m = hash.match(/^#practice\/topic\/([^/]+)$/))) { routeTopic(decodeURIComponent(m[1]), true); return; }
  if (hash.indexOf('#practice/') === 0) deepLinkFailSoft('That practice link was not recognised.');
}

function routeTopic(topicId, noticeOnMiss) {
  if (!state.topics || !state.topics.length) return;
  const idx = state.topics.findIndex(t => t.id === topicId);
  if (idx === -1) {
    if (noticeOnMiss) deepLinkFailSoft('Topic "' + topicId + '" was not found.');
    return;
  }
  state.currentTopic = state.topics[idx];
  applyTopic();
  showScreen('menuScreen');
  showTopicSelectMenu();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
}

function routePracticeRoot(rootId) {
  const entry = rootContentIndex && rootContentIndex.roots && rootContentIndex.roots[rootId];
  if (!entry) { deepLinkFailSoft('Practice link not available for "' + rootId + '".'); return; }
  showRootPracticePanel(entry);
}

function routePracticeRootId(id) {
  const fams = (rootContentIndex && rootContentIndex.pilot_families) || null;
  if (!fams) { deepLinkFailSoft('Practice links are not available right now.'); return; }
  // 1. Exact pilot family key (e.g. "present_perfect")
  if (fams[id]) { showRootPracticePanel(fams[id]); return; }
  // 2. Granular root_id listed in a family (e.g. "A2.relative_clauses.basic" → relative_pronouns)
  for (const key of Object.keys(fams)) {
    if ((fams[key].granular_root_ids || []).indexOf(id) !== -1) { showRootPracticePanel(fams[key]); return; }
  }
  // 3. Parse <CEFR>.<stem>.<rest> and match the stem (covers ids not yet tagged in data).
  //    The stem may be a family key ("present_perfect") or the middle segment its granular
  //    ids use ("modals" → modal_verbs, "relative_clauses" → relative_pronouns).
  const parts = id.split('.');
  if (parts.length >= 2 && /^[ABC][12]$/.test(parts[0])) {
    const stem = parts[1];
    if (fams[stem]) { showRootPracticePanel(fams[stem]); return; }
    for (const key of Object.keys(fams)) {
      const gids = fams[key].granular_root_ids || [];
      if (gids.some(g => g.split('.')[1] === stem)) { showRootPracticePanel(fams[key]); return; }
    }
  }
  deepLinkFailSoft('No practice found for "' + id + '".');
}

function deepLinkFailSoft(msg) {
  NAV.navigate('menuMain');
  const el = document.getElementById('deepLinkNotice');
  if (!el) return;
  el.textContent = msg + ' Showing the main menu instead.';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

function showRootPracticePanel(entry) {
  const titleEl = document.getElementById('rootPracticeTitle');
  const descEl = document.getElementById('rootPracticeDesc');
  const listEl = document.getElementById('rootPracticeEntryPoints');
  if (!titleEl || !descEl || !listEl) { deepLinkFailSoft('Practice view unavailable.'); return; }
  titleEl.textContent = entry.canonical_title || 'Practice';
  descEl.textContent = entry.short_student_description || '';
  listEl.innerHTML = '';
  (entry.practice_entry_points || []).forEach(ep => {
    if (!ep || ep.type !== 'topic' || !ep.id) return;
    const topic = (state.topics || []).find(t => t.id === ep.id);
    if (!topic) return; // skip topics the menu can't open (e.g. exam-only modes)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary';
    const label = ep.label || toTitleCase(topic.title || topic.id);
    const cefr = (ep.cefr && ep.cefr.length) ? ep.cefr : (topic.cefr_levels || []);
    btn.innerHTML = escapeHtml(label) +
      (cefr.length ? ' <span style="color: var(--muted); font-size: 0.8rem;">· ' + escapeHtml(cefr.join(', ')) + '</span>' : '');
    btn.addEventListener('click', () => openPracticeEntryPoint(ep.id, entry.canonical_title));
    listEl.appendChild(btn);
  });
  if (!listEl.children.length) {
    listEl.innerHTML = '<p style="color: var(--muted); font-size: 0.85rem;">No practice entry points available yet.</p>';
  }
  NAV.navigate('menuRootPractice', { context: entry.canonical_title || 'Practice' });
}

function openPracticeEntryPoint(topicId, contextLabel) {
  const idx = (state.topics || []).findIndex(t => t.id === topicId);
  if (idx === -1) { deepLinkFailSoft('Topic "' + topicId + '" was not found.'); return; }
  state.currentTopic = state.topics[idx];
  applyTopic();
  NAV.navigate('menuTopicSelect', { context: contextLabel || 'Topics' });
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
  location.hash = 'topic/' + topicId;
}

function showTopicSelectMenu() {
  showMenuPanel('menuTopicSelect');
  updateNavContext('Choose topic');

  const f = document.getElementById('topicFilterInput');
  const results = document.getElementById('topicSearchResults');
  const sel = document.getElementById('topicSelect');

  if (f) f.value = '';
  if (results) {
    results.classList.add('hidden');
    results.innerHTML = '';
  }
  if (sel) Array.from(sel.options).forEach(o => o.hidden = false);
  const catSel = document.getElementById('categorySelect');
  if (catSel) catSel.value = '';
  const backToPrevBtn = document.getElementById('topicSelectBackToPrevBtn');
  if (backToPrevBtn) {
    if (state.returnToAfterTopicSelect === 'diagnostic') {
      backToPrevBtn.classList.remove('hidden');
      backToPrevBtn.textContent = 'Back to test';
    } else {
      backToPrevBtn.classList.add('hidden');
    }
  }
  if (state.returnToAfterTopicSelect === 'diagnostic' && state.currentTopic && state.topics && state.topics.length) {
    const idx = state.topics.findIndex(t => t.id === state.currentTopic.id);
    const sel = document.getElementById('topicSelect');
    if (sel && idx >= 0) sel.value = String(idx);
  }

  // Keyboard-first: focus the first action button (or the filter if empty) to minimize mouse
  setTimeout(() => {
    if (f && f.value.trim() === '') {
      f.focus();
    } else if (topicActionButtons[0]) {
      topicActionButtons[0].focus();
    }
  }, 0);
}

function navigateFromIntroToTopic(topicId) {
  if (!state.topics || !state.topics.length) return;
  const idx = state.topics.findIndex(function(t) { return t.id === topicId; });
  if (idx === -1) return;
  state.currentTopic = state.topics[idx];
  applyTopic();
  location.hash = 'topic/' + topicId;
  state.returnToAfterTopicSelect = null;
  state.coursePart = null;
  state.coursePhase = null;
  state.courseCurriculum = null;
  document.getElementById('introScreen').classList.add('hidden');
  document.body.classList.remove('viewing-content');
  showScreen('menuScreen');
  showTopicSelectMenu();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
  const summaryEl = document.getElementById('scoresSummary');
  if (summaryEl) {
    const lastBest = getLastBest(state.currentTopic.id);
    if (lastBest.last) {
      summaryEl.textContent = 'Last: ' + lastBest.last[0] + '/' + lastBest.last[1] +
        (lastBest.best && (lastBest.best[0] !== lastBest.last[0] || lastBest.best[1] !== lastBest.last[1])
          ? '  •  Best: ' + lastBest.best[0] + '/' + lastBest.best[1] : '');
    } else {
      summaryEl.textContent = '';
    }
  }
}

function showMainMenu() {
  showScreen('menuScreen');
  document.body.classList.remove('viewing-reference', 'viewing-content');
  showMenuPanel('menuMain');
  updateNavContext('');

  // No point showing Back on the very first screen
  const backBtn = document.getElementById('navBackBtn');
  if (backBtn) backBtn.style.display = (NAV.history.length === 0) ? 'none' : '';
}






async function openTopicIntroFromResults(topicId) {
  if (!state.topics || !state.topics.length) return;
  const idx = state.topics.findIndex(t => t.id === topicId);
  if (idx === -1) return;
  state.currentTopic = state.topics[idx];
  applyTopic();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
  state.quizMode = 'normal';
  state.returnToAfterTopicSelect = null;
  document.getElementById('resultScreen').classList.add('hidden');
  document.body.classList.remove('viewing-content');
  await startPart1();
}

try {
document.getElementById('startBtn').addEventListener('click', startQuiz);
document.getElementById('startPart1Btn').addEventListener('click', startPart1);
document.getElementById('startPart2Btn').addEventListener('click', async () => {
  // "2: Multiple Choice" path — enforce the documented 10-question limit for predictability
  state._directMCLaunch = true;
  await startPart2();
  // Post-process: enforce limit + update title for honest progress display
  if (state._directMCLaunch && state.currentQuestions && state.currentQuestions.length > 10) {
    state.currentQuestions = state.currentQuestions.slice(0, 10);
    state.currentSetTitle = (state.currentTopic?.title || state.currentTopic?.id || 'Topic') + ' — 10 MC questions';
  }
  state._directMCLaunch = false;
});
document.getElementById('openPracticeSetupBtn').addEventListener('click', () => {
  if (!hasValidTopicSelected()) {
    alert('Please choose a topic first.');
    return;
  }
  document.getElementById('menuTopicSelect').classList.add('hidden');
  document.getElementById('menuPracticeSetup').classList.remove('hidden');
  applyTopic();
  const topicEl = document.getElementById('practiceSetupTopic');
  if (topicEl) {
    const baseTitle = state.currentTopic ? toTitleCase(state.currentTopic.title || state.currentTopic.id) : '';
    topicEl.textContent = baseTitle ? ('3: Further Practice – ' + baseTitle) : '3: Further Practice';
  }
});
document.getElementById('practiceSetupBackBtn').addEventListener('click', () => {
  NAV.back();   // reliable history-backed back
});
document.getElementById('openTopicSelectBtn').addEventListener('click', () => {
  state.returnToAfterTopicSelect = null;
  NAV.navigate('menuTopicSelect', { context: 'Topics' });
});
// Keyboard support on topic selection screen
const topicActionButtons = [
  'startPart1Btn',
  'startPart2Btn',
  'openPracticeSetupBtn'
].map(id => document.getElementById(id)).filter(Boolean);

let topicActionIndex = 0;

function focusTopicAction(index) {
  topicActionIndex = (index + topicActionButtons.length) % topicActionButtons.length;
  topicActionButtons[topicActionIndex].focus();
}

// When showing the topic panel, make the first action button the default focus target
const originalShowTopicSelectMenu = showTopicSelectMenu;
showTopicSelectMenu = function() {
  originalShowTopicSelectMenu.apply(this, arguments);
  // Reset to first action as default
  topicActionIndex = 0;
  // Give focus to the first action button after a tick so the panel is visible
  setTimeout(() => {
    if (topicActionButtons[0] && !document.getElementById('topicFilterInput')?.matches(':focus')) {
      topicActionButtons[0].focus();
    }
  }, 0);
};

// Keyboard navigation on the topic action buttons
document.addEventListener('keydown', (e) => {
  const panel = document.getElementById('menuTopicSelect');
  if (!panel || panel.classList.contains('hidden')) return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    focusTopicAction(topicActionIndex + 1);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    focusTopicAction(topicActionIndex - 1);
  }
  if (e.key === 'Enter') {
    // If focus is on one of the action buttons, let it click naturally
    // If focus is elsewhere (e.g. select or filter), trigger the current focused action
    const active = document.activeElement;
    if (!topicActionButtons.includes(active)) {
      e.preventDefault();
      topicActionButtons[topicActionIndex].click();
    }
  }
});

// Also support Enter on the native select for convenience
document.getElementById('topicSelect').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && hasValidTopicSelected()) {
    e.preventDefault();
    topicActionButtons[topicActionIndex].click();
  }
});
// Always-visible back controls on the topic select screen (normal flow)
document.getElementById('topicSelectBackBtn')?.addEventListener('click', () => {
  NAV.back();
});

// Keep the old diagnostic-only back button working
document.getElementById('topicSelectBackToPrevBtn')?.addEventListener('click', () => {
  if (state.returnToAfterTopicSelect === 'diagnostic') {
    document.getElementById('menuScreen').classList.add('hidden');
    document.body.classList.add('viewing-content');
    document.getElementById('quizScreen').classList.remove('hidden');
  }
});
document.getElementById('openReferenceBtn').addEventListener('click', showReference);
document.getElementById('openDiagnosticSetupBtn').addEventListener('click', () => {
  document.getElementById('menuMain').classList.add('hidden');
  document.getElementById('menuTopicSelect').classList.add('hidden');
  document.getElementById('menuPracticeSetup').classList.add('hidden');
  document.getElementById('menuDiagnosticSetup').classList.remove('hidden');
});

document.getElementById('diagnostic20Btn').addEventListener('click', () => startDiagnostic(20));
document.getElementById('diagnostic50Btn').addEventListener('click', () => startDiagnostic(50));
document.getElementById('diagnostic100Btn').addEventListener('click', () => startDiagnostic(100));
function handleIntroBack() {
  if (state.writingTipsIntroActive) {
    if (state.writingTipsIntroSectionIndex > 0) {
      showWritingTipsIntroSection(state.writingTipsIntroSectionIndex - 1);
    } else {
      state.writingTipsIntroActive = false;
      document.getElementById('introScreen').classList.add('hidden');
      document.body.classList.remove('viewing-content');
      showScreen('menuScreen');
      showMainMenu();
    }
    return;
  }
  if (state.introSectionIndex > 0) {
    showIntroSection(state.introSectionIndex - 1);
  } else {
    document.getElementById('introScreen').classList.add('hidden');
    document.body.classList.remove('viewing-content');
    showScreen('menuScreen');
    showTopicSelectMenu();
  }
}
document.getElementById('introScreen').addEventListener('click', function(e) {
  const topicLink = e.target.closest('a.intro-topic-link');
  if (topicLink) {
    e.preventDefault();
    const id = topicLink.getAttribute('data-topic-id');
    if (id) navigateFromIntroToTopic(id);
    return;
  }
  if (e.target.closest('a.intro-preplist-link')) {
    e.preventDefault();
    void showPrepositionsList('intro');
    return;
  }
  if (e.target.closest('a.intro-ref-index-link')) {
    e.preventDefault();
    showReferenceIndexFromIntro();
    return;
  }
  if (e.target.closest('a.intro-reflinkers-link')) {
    e.preventDefault();
    void showConjunctionsLinkersRefFromIntro();
    return;
  }
});
document.getElementById('introBackBtn').addEventListener('click', handleIntroBack);
document.getElementById('introNextBtn').addEventListener('click', () => {
  if (state.writingTipsIntroActive) {
    const sections = (state.writingTipsData && state.writingTipsData.intro_sections) || [];
    if (state.writingTipsIntroSectionIndex < sections.length - 1) {
      showWritingTipsIntroSection(state.writingTipsIntroSectionIndex + 1);
    } else {
      state.writingTipsIntroActive = false;
      startWritingTipsQuiz();
    }
    return;
  }
  const courseIntroSections = getCourseIntroSections();
  if (courseIntroSections.length > 0 && state.introSectionIndex < courseIntroSections.length - 1) {
    showIntroSection(state.introSectionIndex + 1);
  } else {
    document.getElementById('introScreen').classList.add('hidden');
    if (state.coursePart === 1) {
      const checkQuestions = (state.courseCurriculum && state.courseCurriculum.check && state.courseCurriculum.check.questions) || [];
      if (checkQuestions.length > 0) startCourseSection('check');
      else renderMenu();
    }
  }
});
document.getElementById('sectionCompleteNextBtn').addEventListener('click', advanceCourseToNext);
document.getElementById('sectionCompleteBackBtn').addEventListener('click', renderMenu);
document.getElementById('sectionCompleteMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('sectionCompleteGuidedPracticeBtn').addEventListener('click', () => {
  document.getElementById('sectionCompleteScreen').classList.add('hidden');
  startPart2();
});
document.getElementById('sectionCompleteRetryWrongBtn').addEventListener('click', () => {
  const toRetry = state.wrongIndices.map(i => state.currentQuestions[i]);
  state.currentQuestions = toRetry;
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = true;
  document.getElementById('sectionCompleteScreen').classList.add('hidden');
  document.body.classList.add('viewing-content');
  document.getElementById('quizScreen').classList.remove('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  showQuestion();
});
document.getElementById('sectionCompleteFurtherPracticeBtn').addEventListener('click', () => {
  document.getElementById('sectionCompleteScreen').classList.add('hidden');
  document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('menuMain').classList.add('hidden');
  document.getElementById('menuTopicSelect').classList.add('hidden');
  document.getElementById('menuPracticeSetup').classList.remove('hidden');
  applyTopic();
  const topicEl = document.getElementById('practiceSetupTopic');
  if (topicEl) topicEl.textContent = state.currentTopic ? toTitleCase(state.currentTopic.title || state.currentTopic.id) : '';
});
document.getElementById('resultFurtherPracticeBtn').addEventListener('click', () => {
  // Go back to topic select then immediately open the practice setup panel
  NAV.navigate('menuTopicSelect', { context: 'Further practice' });
  // After the panel is shown, open the setup (small delay for DOM)
  setTimeout(() => {
    const topicSelectPanel = document.getElementById('menuTopicSelect');
    if (topicSelectPanel) topicSelectPanel.classList.add('hidden');
    const practicePanel = document.getElementById('menuPracticeSetup');
    if (practicePanel) {
      practicePanel.classList.remove('hidden');
      applyTopic();
      const topicEl = document.getElementById('practiceSetupTopic');
      if (topicEl) topicEl.textContent = state.currentTopic ? toTitleCase(state.currentTopic.title || state.currentTopic.id) : '';
    }
  }, 0);
});
document.getElementById('submitBtn').addEventListener('click', submitAnswer);
document.getElementById('nextBtn').addEventListener('click', nextQuestion);
document.getElementById('retryWrongBtn').addEventListener('click', retryWrong);
document.getElementById('backToMenuBtn').addEventListener('click', () => NAV.navigate('menuMain'));
document.getElementById('exitQuizBtn').addEventListener('click', () => {
  // Prefer NAV history for consistent Back feel (A); fallback safe
  if (NAV.history && NAV.history.length > 0) {
    NAV.back();
  } else {
    NAV.navigate('menuMain');
  }
});
document.getElementById('quizMainMenuBtn').addEventListener('click', () => NAV.navigate('menuMain'));
document.getElementById('quizScreen').addEventListener('click', function(e) {
  const link = e.target && e.target.closest && e.target.closest('.diagnostic-topic-link');
  if (!link) return;
  e.preventDefault();
  const topicId = link.getAttribute('data-topic-id');
  if (!topicId || !state.topics || !state.topics.length) return;
  const idx = state.topics.findIndex(t => t.id === topicId);
  if (idx === -1) return;
  state.currentTopic = state.topics[idx];
  applyTopic();
  state.returnToAfterTopicSelect = state.quizMode === 'diagnostic' ? 'diagnostic' : null;
  location.hash = 'topic/' + topicId;
  document.getElementById('quizScreen').classList.add('hidden');
  document.getElementById('menuScreen').classList.remove('hidden');
  showTopicSelectMenu();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
});
document.getElementById('introMainMenuBtn').addEventListener('click', () => {
  if (state.writingTipsIntroActive) state.writingTipsIntroActive = false;
  showMainMenu();
});
const viewPrepositionsListBtn = document.getElementById('viewPrepositionsListBtn');
if (viewPrepositionsListBtn) viewPrepositionsListBtn.addEventListener('click', () => showPrepositionsList('menu'));
document.getElementById('viewPrepositionsListFromIntroBtn').addEventListener('click', () => showPrepositionsList('intro'));
document.getElementById('prepositionsListBackBtn').addEventListener('click', hidePrepositionsList);
document.getElementById('prepositionsListMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('prepositionsListPrintBtn').addEventListener('click', () => window.print());
const viewPhrasalVerbsDictBtn = document.getElementById('viewPhrasalVerbsDictionaryBtn');
if (viewPhrasalVerbsDictBtn) viewPhrasalVerbsDictBtn.addEventListener('click', () => showPhrasalVerbsDictionary('menu'));
document.getElementById('viewPhrasalVerbsFromIntroBtn').addEventListener('click', () => showPhrasalVerbsDictionary('intro'));
const viewOpenClozeRefFromIntroBtn = document.getElementById('viewOpenClozeRefFromIntroBtn');
if (viewOpenClozeRefFromIntroBtn) viewOpenClozeRefFromIntroBtn.addEventListener('click', showOpenClozeRefFromIntro);
const viewFixedPhrasesRefFromIntroBtn = document.getElementById('viewFixedPhrasesRefFromIntroBtn');
if (viewFixedPhrasesRefFromIntroBtn) viewFixedPhrasesRefFromIntroBtn.addEventListener('click', showFixedPhrasesRefFromIntro);
const viewReportedSpeechRefFromIntroBtn = document.getElementById('viewReportedSpeechRefFromIntroBtn');
if (viewReportedSpeechRefFromIntroBtn) viewReportedSpeechRefFromIntroBtn.addEventListener('click', showReportedSpeechRefFromIntro);
const viewInfinitiveIngRefFromIntroBtn = document.getElementById('viewInfinitiveIngRefFromIntroBtn');
if (viewInfinitiveIngRefFromIntroBtn) viewInfinitiveIngRefFromIntroBtn.addEventListener('click', showInfinitiveIngRefFromIntro);
document.getElementById('phrasalVerbsDictionaryBackBtn').addEventListener('click', hidePhrasalVerbsDictionary);
document.getElementById('phrasalVerbsDictionaryMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('phrasalVerbsDictionaryPrintBtn').addEventListener('click', () => window.print());
document.getElementById('referenceBackBtn').addEventListener('click', onReferenceBackClick);
document.getElementById('reportQuestionBtn').addEventListener('click', function() {
  if (!state.currentQuestions.length || state.currentIndex < 0 || state.currentIndex >= state.currentQuestions.length) return;
  var input = document.getElementById('flagReasonInput');
  if (input) input.value = '';
  openOverlay('flagReasonOverlay', this);
});
document.getElementById('reportIntroCardBtn').addEventListener('click', function() {
  var input = document.getElementById('flagReasonInput');
  if (input) input.value = '';
  openOverlay('flagReasonOverlay', this);
});
document.getElementById('flagReasonSubmitBtn').addEventListener('click', function() {
  var reasonText = (document.getElementById('flagReasonInput').value || '').trim();
  var introScreen = document.getElementById('introScreen');
  if (introScreen && !introScreen.classList.contains('hidden')) addReportedIntroCard('', reasonText);
  else addReportedQuestion('', reasonText);
  closeOverlay('flagReasonOverlay');
});
document.getElementById('flagReasonCancelBtn').addEventListener('click', function() {
  closeOverlay('flagReasonOverlay');
});
document.getElementById('flagReasonInput').addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  document.getElementById('flagReasonSubmitBtn').click();
});
var viewReportedBtn = document.getElementById('viewReportedQuestionsBtn');
if (viewReportedBtn) viewReportedBtn.addEventListener('click', function() {
  renderReportedQuestionsList();
  openOverlay('reportedQuestionsOverlay', this);
});
document.getElementById('viewReportedQuestionsBtnResult').addEventListener('click', function() {
  renderReportedQuestionsList();
  openOverlay('reportedQuestionsOverlay', this);
});
document.getElementById('viewReportedQuestionsBtnSection').addEventListener('click', function() {
  renderReportedQuestionsList();
  openOverlay('reportedQuestionsOverlay', this);
});
document.getElementById('reportedQuestionsCloseBtn').addEventListener('click', function() {
  closeOverlay('reportedQuestionsOverlay');
});
document.getElementById('reportedQuestionsCopyBtn').addEventListener('click', function() {
  const list = getReportedQuestions();
  const text = list.length === 0 ? 'No flagged questions.' : list.map(function(r, i) {
    const reason = getReportedReasonLabel(r);
    return '---\nID: Q' + (i + 1) + '\nTopic: ' + (r.topicTitle || r.topicId || '—') + '\nSource: ' + (r.source || '—') + '\nDate: ' + (r.timestamp ? new Date(r.timestamp).toLocaleString() : '—') + (reason !== '—' ? '\nReason: ' + reason : '') + '\nQuestion: ' + (r.questionText || '');
  }).join('\n\n');
  var copyBtn = document.getElementById('reportedQuestionsCopyBtn');
  var copyOk = function() {
    copyBtn.textContent = 'Copied!';
    setTimeout(function() { copyBtn.textContent = 'Copy all to clipboard'; }, 1500);
  };
  var copyFail = function() {
    copyBtn.textContent = 'Copy failed';
    setTimeout(function() { copyBtn.textContent = 'Copy all to clipboard'; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(copyOk).catch(function() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) copyOk(); else copyFail();
      } catch (e) { copyFail(); }
    });
  } else {
    try {
      var ta2 = document.createElement('textarea');
      ta2.value = text;
      ta2.setAttribute('readonly', '');
      ta2.style.position = 'fixed';
      ta2.style.left = '-9999px';
      document.body.appendChild(ta2);
      ta2.select();
      var ok2 = document.execCommand('copy');
      document.body.removeChild(ta2);
      if (ok2) copyOk(); else copyFail();
    } catch (e) { copyFail(); }
  }
});
document.getElementById('reportedQuestionsClearBtn').addEventListener('click', function() {
  if (getReportedQuestions().length === 0) return;
  if (confirm('Clear all flagged questions? This cannot be undone.')) {
    localStorage.removeItem(REPORTED_QUESTIONS_KEY);
    renderReportedQuestionsList();
  }
});
document.getElementById('referencePrintBtn').addEventListener('click', () => window.print());
document.getElementById('openInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
});
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' || e.defaultPrevented) return;
  const el = e.target;
  if (el && el.isContentEditable) return;
  const tag = el && el.tagName;
  if (tag === 'TEXTAREA') return;
  if (tag === 'INPUT' && (!el.type || (el.type !== 'button' && el.type !== 'submit' && el.type !== 'reset'))) return;
  if (el && el.closest && el.closest('[role="dialog"]')) return;

  const introSc = document.getElementById('introScreen');
  if (introSc && !introSc.classList.contains('hidden')) {
    e.preventDefault();
    document.getElementById('introNextBtn').click();
    return;
  }
  const quizSc = document.getElementById('quizScreen');
  if (quizSc && !quizSc.classList.contains('hidden')) {
    const fb = document.getElementById('feedbackBlock');
    if (fb && !fb.classList.contains('hidden')) {
      e.preventDefault();
      document.getElementById('nextBtn').click();
      return;
    }
    e.preventDefault();
    document.getElementById('submitBtn').click();
    return;
  }
  const secSc = document.getElementById('sectionCompleteScreen');
  if (secSc && !secSc.classList.contains('hidden')) {
    e.preventDefault();
    document.getElementById('sectionCompleteNextBtn').click();
    return;
  }
  const resSc = document.getElementById('resultScreen');
  if (resSc && !resSc.classList.contains('hidden')) {
    const retry = document.getElementById('retryWrongBtn');
    if (retry && !retry.classList.contains('hidden')) {
      e.preventDefault();
      retry.click();
      return;
    }
    e.preventDefault();
    document.getElementById('backToMenuBtn').click();
  }
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var flagOverlay = document.getElementById('flagReasonOverlay');
    if (flagOverlay && !flagOverlay.classList.contains('hidden')) { closeOverlay('flagReasonOverlay'); return; }
    var reportedOverlay = document.getElementById('reportedQuestionsOverlay');
    if (reportedOverlay && !reportedOverlay.classList.contains('hidden')) { closeOverlay('reportedQuestionsOverlay'); return; }

    // Use real navigation history when possible
    if (NAV.history.length > 0) {
      e.preventDefault();
      NAV.back();
      return;
    }

    // Always provide a reliable escape from any content screen
    e.preventDefault();
    NAV.navigate('menuMain');
    return;
  }

  var quizScreen = document.getElementById('quizScreen');
  if (!quizScreen || quizScreen.classList.contains('hidden')) return;
  var fb = document.getElementById('feedbackBlock');
  var feedbackVisible = fb && !fb.classList.contains('hidden');
  var q = state.currentQuestions && state.currentQuestions[state.currentIndex];
  if (!q) return;

  if (e.key === 'Enter') {
    if (feedbackVisible) return;
    if (q.type === 'mc' && state.selectedMc != null) { e.preventDefault(); submitAnswer(); }
    return;
  }

  if (q.type === 'mc' && !feedbackVisible) {
    var mcKeyMap = {'1':'a','2':'b','3':'c','4':'d','a':'a','b':'b','c':'c','d':'d'};
    var mapped = mcKeyMap[e.key.toLowerCase()];
    if (mapped && q.options && q.options[mapped]) {
      e.preventDefault();
      var mcBlock = document.getElementById('mcBlock');
      mcBlock.querySelectorAll('.option').forEach(function(o) { o.classList.remove('selected'); });
      var target = mcBlock.querySelector('[data-option="' + mapped + '"]');
      if (target) {
        target.classList.add('selected');
        var radio = target.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      }
      state.selectedMc = mapped;
      submitAnswer();
    }
  }
});

document.getElementById('topicSelect').addEventListener('change', () => {
  const val = document.getElementById('topicSelect').value;
  if (val === '' || val === '-1') return;
  const idx = parseInt(val, 10);
  if (state.topics[idx] != null) {
    state.currentTopic = state.topics[idx];
    applyTopic();
    const summaryEl = document.getElementById('scoresSummary');
    const lastBest = getLastBest(state.currentTopic.id);
    if (lastBest.last) {
      summaryEl.textContent = 'Last: ' + lastBest.last[0] + '/' + lastBest.last[1] +
        (lastBest.best && (lastBest.best[0] !== lastBest.last[0] || lastBest.best[1] !== lastBest.last[1])
          ? '  •  Best: ' + lastBest.best[0] + '/' + lastBest.best[1] : '');
    } else {
      summaryEl.textContent = '';
    }
  }
});

} catch (err) {
  console.error('Quiz setup failed:', err);
  alert('Quiz setup failed. Open the Developer Console (F12) and check the Console tab for details.\n\nError: ' + (err && err.message));
}

registerRefCallbacks({ showExamPracticeMenu: () => {}, showWritingTipsIntroSection });
registerCurrCallbacks({ showQuestion, loadCurriculumData, loadQuestions, hasValidTopicSelected, syncCurrentTopicFromDropdown, getTopicTitle, renderMenu });
registerQuizCallbacks({ renderMenu, advanceCourseToNext, getWeakSpotQuestions, applyTopic, answerMatches, openTopicIntroFromResults });

// === New hybrid visible elements ===

document.getElementById('showTreeBtn')?.addEventListener('click', () => {
  NAV.navigate('menuTreeOverview', { context: 'Grammar Tree' });
});

document.getElementById('treeOverviewBackBtn')?.addEventListener('click', () => {
  NAV.back();   // use history so Esc/Back feel consistent
});

document.getElementById('rootPracticeBackBtn')?.addEventListener('click', () => {
  NAV.back();
});

function showTreeOverview() {
  showMenuPanel('menuTreeOverview');
  renderSimpleTreeOverview();
  // Note: NAV.navigate should be used by callers so history is correct
}

function renderSimpleTreeOverview() {
  const visualContainer = document.getElementById('treeRootsVisual');
  if (!visualContainer) return;

  visualContainer.innerHTML = '';

  if (!grammarTree || !grammarTree.roots || !pilotMapping) {
    visualContainer.innerHTML = `
      <div style="padding: 1rem; background: #3a2f00; border: 1px solid #f57f17; border-radius: 6px; color: #ffeb3b; height: 100%;">
        <strong>Tree data or mapping not loaded yet.</strong><br>
        Try a hard refresh (Ctrl+Shift+R) with DevTools → Network → "Disable cache" checked.
      </div>
    `;
    return;
  }

  // Group families by primary root
  const familiesByRoot = {};
  grammarTree.roots.forEach(r => familiesByRoot[r.id] = []);
  (pilotMapping.pilot_families || []).forEach(fam => {
    if (familiesByRoot[fam.primary_root]) familiesByRoot[fam.primary_root].push(fam);
  });

  // === Honest progress semantics (all values are real 0..1, no decorative baselines) ===
  //
  // - Topic strength   = best quiz score ratio for that topic (0 if never attempted;
  //                      0.6 if the topic was completed but has no recorded score).
  // - Family progress  = mean strength across the family's topics. 1.0 = "done":
  //                      a best score of 100% on every topic in the family.
  // - Lateral root     = mean strength across ALL menu topics whose `root` is that
  //                      root (not just pilot families), so every topic counts.
  // - Tap root         = practice volume, saturating: 1 - e^(-answered/40). The trunk
  //                      thickens with how much you practise; branches with how well.
  // - On error the tree renders at its resting size (zero progress) — never invented numbers.
  //
  // The SVG adds a small visual floor so a zero-progress tree still looks like a tree;
  // the floor is cosmetic and the tooltips report the real percentages.
  let rootProgress = {};
  let familyProgress = {};
  try {
    const bank = loadMemoryBank();
    const completionMap = getTopicCompletionMap();

    const topicStrength = (topicId) => {
      const lastBest = getLastBest(topicId);
      if (lastBest.best && lastBest.best[1] > 0) return lastBest.best[0] / lastBest.best[1];
      if (completionMap[topicId]) return 0.6;
      return 0;
    };
    const mean = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;

    grammarTree.roots.forEach(r => {
      const topics = (state.topics || []).filter(t => t.root === r.id);
      rootProgress[r.id] = mean(topics.map(t => topicStrength(t.id)));
    });

    (pilotMapping.pilot_families || []).forEach(fam => {
      familyProgress[fam.id] = mean((fam.current_topics || []).map(t => topicStrength(t.id)));
    });

    const bankSize = Object.keys(bank || {}).length;
    rootProgress.tap_root = 1 - Math.exp(-bankSize / 40);
  } catch (e) {
    console.warn('Tree progress calculation failed, rendering resting tree:', e);
    rootProgress = {};
    familyProgress = {};
  }

// === Botanical renderer (ported from tree_model_c2_oak.html, below-ground only) ===
  // Grammar = the root system. Cream/earth palette from the Tree Model house style;
  // geometry is deterministic; sizes are driven by the real progress numbers above.
  const W = 1280, H = 1000;
  const C = {
    cream: '#FAF7F0', earth: '#ECE2CD', earthLn: '#CBB98D',
    wood: '#B98C5A', woodLn: '#7A5733', root: '#A97F50', rootLn: '#6E4E2C',
    ink: '#1F1F1F', ox: '#6B2737', hair: '#A99E86', ochre: '#C8893B',
    ochreDk: '#A6691F', muted: '#5A5346'
  };
  const cx = 640, yG = 150;              // ground line
  const Rx = 640, Ry = yG + 24;          // root fan origin
  const rrx = 470, rry = 620;            // root spread ellipse (full mastery reach)

  const rad = d => d * Math.PI / 180;
  const f = n => (Math.round(n * 10) / 10);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Tapered ribbon along a quadratic Bézier (the mockup's limb())
  function limb(p0, p1, p2, w0, w1, steps = 26) {
    const L = [], R = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, mt = 1 - t;
      const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
      const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
      const tx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
      const ty = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len, ny = tx / len;
      const w = (w0 + (w1 - w0) * t) / 2;
      L.push([x + nx * w, y + ny * w]);
      R.push([x - nx * w, y - ny * w]);
    }
    let d = `M${f(L[0][0])} ${f(L[0][1])}`;
    for (let i = 1; i < L.length; i++) d += `L${f(L[i][0])} ${f(L[i][1])}`;
    d += `L${f(R[R.length - 1][0])} ${f(R[R.length - 1][1])}`;
    for (let i = R.length - 2; i >= 0; i--) d += `L${f(R[i][0])} ${f(R[i][1])}`;
    return d + 'Z';
  }
  const qpoint = (p0, p1, p2, t) => {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
  };

  // Root fan: angles + two-line display names from the mockup
  const ROOT_DEFS = [
    { id: 'verb_phrase',            lines: ['Verb phrase'],             ang: 200 },
    { id: 'noun_phrase',            lines: ['Noun phrase'],             ang: 222 },
    { id: 'sentence_syntax',        lines: ['Sentence', 'syntax'],      ang: 244 },
    { id: 'clause_linking',         lines: ['Clause', 'linking'],       ang: 296 },
    { id: 'verb_complementation',   lines: ['Verb', 'complementation'], ang: 318 },
    { id: 'prepositions_particles', lines: ['Prepositions', '& particles'], ang: 340 },
  ];

  const parts = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${C.cream}"/>`);

  // Soil + ground line + deterministic speckle
  let soil = `<rect x="0" y="${yG}" width="${W}" height="${H - yG}" fill="${C.earth}"/>`;
  soil += `<line x1="0" y1="${yG}" x2="${W}" y2="${yG}" stroke="${C.earthLn}" stroke-width="2"/>`;
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 97 + 31) % W);
    const sy = yG + 24 + ((i * 53 + 17) % (H - yG - 40));
    soil += `<circle cx="${sx}" cy="${sy}" r="1.6" fill="${C.earthLn}" opacity="0.35"/>`;
  }
  parts.push(soil);

  // Trunk stub above ground (the crown lives off-canvas — this app is the roots)
  parts.push(`<path d="${limb({ x: cx, y: yG + 6 }, { x: cx - 5, y: 70 }, { x: cx - 4, y: 2 }, 152, 92)}" fill="${C.wood}" stroke="${C.woodLn}" stroke-width="0.8"/>`);

  // Hint line, above ground
  parts.push(`<text x="26" y="44" font-size="15" font-style="italic" font-family="Georgia, 'Source Serif 4', serif" fill="${C.muted}">The roots of your grammar — they grow with your best scores.</text>`
    + `<text x="26" y="66" font-size="15" font-style="italic" font-family="Georgia, 'Source Serif 4', serif" fill="${C.muted}">Click any root or knot to practise it.</text>`);

  // Tap root — practice volume (thickens + deepens as you practise)
  const tapProgress = rootProgress.tap_root || 0;
  const tapPct = Math.round(tapProgress * 100);
  const tapTipY = yG + 60 + (H - yG - 240) * (0.7 + 0.3 * tapProgress);
  const tapW = 30 + 14 * tapProgress;
  parts.push(`<path data-deeplink="practice/root/tap_root" data-tap-progress="${f(tapProgress * 100) / 100}" `
    + `aria-label="Tap root, practice volume ${tapPct} percent. Go to foundation practice." `
    + `d="${limb({ x: cx, y: yG + 10 }, { x: cx - 9, y: (yG + tapTipY) / 2 }, { x: cx + 1, y: tapTipY }, tapW, 6.5)}" `
    + `fill="${C.root}" stroke="${C.rootLn}" stroke-width="0.8">`
    + `<title>Tap root — practice volume ${tapPct}% (grows with every question you answer)</title></path>`);
  // TAP ROOT callout under the tip
  parts.push(`<text x="${cx}" y="${f(tapTipY + 34)}" text-anchor="middle">`
    + `<tspan x="${cx}" font-size="19" font-weight="600" letter-spacing=".14em" fill="${C.ox}">TAP ROOT</tspan>`
    + `<tspan x="${cx}" dy="22" font-size="13" font-style="italic" fill="${C.muted}">foundation — thickens as you practise</tspan></text>`);

  // Lateral roots + family knots + labels
  let knots = '', labels = '';
  ROOT_DEFS.forEach(def => {
    const m = rootProgress[def.id] || 0;
    const pct = Math.round(m * 100);
    // 0.78 reach floor is cosmetic (a resting tree should still fill the soil);
    // mastery adds the final stretch, plus width and rootlet density below.
    const reach = 0.78 + 0.22 * m;
    const r = rad(def.ang);
    const tipX = Rx + rrx * reach * Math.cos(r);
    const tipY = Ry - rry * reach * Math.sin(r);
    const p0 = { x: cx + 16 * Math.cos(r), y: Ry };
    const mX = (p0.x + tipX) / 2, mY = (p0.y + tipY) / 2;
    const ctrl = { x: mX * 0.62 + tipX * 0.38, y: mY + 64 * reach };
    const p2 = { x: tipX, y: tipY };
    const baseW = 18 + 10 * m;
    const title = `${def.lines.join(' ')} — mastery ${pct}% (average best scores). Click to practise.`;
    parts.push(`<path data-deeplink="practice/root/${def.id}" data-root-id="${def.id}" data-mastery="${f(m * 100) / 100}" `
      + `aria-label="${esc(def.lines.join(' '))} root, mastery ${pct} percent. Go to practice." `
      + `d="${limb(p0, ctrl, p2, baseW, 3.6)}" fill="${C.root}" stroke="${C.rootLn}" stroke-width="0.8">`
      + `<title>${esc(title)}</title></path>`);

    // Fine rootlets — more with mastery (deterministic)
    const rootletCount = 1 + Math.floor(m * 2.9);
    for (let i = 0; i < rootletCount; i++) {
      const t = 0.5 + i * 0.18;
      const pA = qpoint(p0, ctrl, p2, t);
      const side = (i % 2 === 0 ? 1 : -1);
      const sAng = def.ang + side * 26;
      const sr = rad(sAng);
      const sLen = (34 + 30 * m) * (1 - i * 0.18);
      const pB = { x: pA.x + sLen * Math.cos(sr), y: pA.y - sLen * Math.sin(sr) };
      parts.push(`<path d="${limb(pA, { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 + 10 }, pB, 5, 1.6, 12)}" fill="${C.root}" opacity="0.8"/>`);
    }

    // Root name label beyond the tip (leader line + oxblood dot, mockup style)
    const off = 62;
    const lx = Rx + (rrx * reach + off) * Math.cos(r);
    const ly = Ry - (rry * reach + off) * Math.sin(r);
    const anchor = Math.cos(r) < -0.2 ? 'end' : 'start';
    labels += `<line x1="${f(tipX)}" y1="${f(tipY)}" x2="${f(lx + (anchor === 'end' ? 6 : -6))}" y2="${f(ly - 4)}" stroke="${C.hair}" stroke-width="1"/>`;
    labels += `<rect x="${f(lx + (anchor === 'end' ? 4 : -10))}" y="${f(ly - 8)}" width="6" height="6" fill="${C.ox}"/>`;
    const tx = lx + (anchor === 'end' ? -4 : 4);
    const startY = ly - (def.lines.length - 1) * (16 * 1.12) / 2;
    labels += `<text x="${f(tx)}" y="${f(startY)}" text-anchor="${anchor}" font-size="16" font-weight="500" fill="${C.ink}">`;
    def.lines.forEach((ln, i) => { labels += `<tspan x="${f(tx)}" dy="${i === 0 ? 0 : f(16 * 1.12)}">${esc(ln)}</tspan>`; });
    labels += `</text>`;

    // Family knots along this root
    const families = familiesByRoot[def.id] || [];
    families.forEach((fam, idx) => {
      const fProg = familyProgress[fam.id] || 0;
      const fPct = Math.round(fProg * 100);
      const t = 0.52 + idx * 0.17;
      const k = qpoint(p0, ctrl, p2, t);
      const kr = 7.5 + 4.5 * fProg;
      const ripe = fProg >= 0.7;
      const fill = ripe ? C.ochre : C.root;
      const stroke = ripe ? C.ochreDk : C.rootLn;
      // Steep roots get below-knot labels (side labels would cross neighbouring ribbons)
      const cosr = Math.cos(r);
      let lxF, lyF, anchorF, leader;
      if (Math.abs(cosr) < 0.5) {
        anchorF = 'middle';
        lxF = k.x + (cosr < 0 ? -10 : 10);
        lyF = k.y + kr + 20 + (idx % 2 === 0 ? 0 : 6);
        leader = `<line x1="${f(k.x)}" y1="${f(k.y + kr)}" x2="${f(lxF)}" y2="${f(lyF - 12)}" stroke="${C.hair}" stroke-width="1"/>`;
      } else {
        const side = cosr < 0 ? -1 : 1;
        anchorF = side < 0 ? 'end' : 'start';
        lxF = k.x + side * (kr + 14);
        lyF = k.y + 5 + (idx % 2 === 0 ? -12 : 16);
        leader = `<line x1="${f(k.x + side * kr)}" y1="${f(k.y)}" x2="${f(lxF - side * 4)}" y2="${f(lyF - 4)}" stroke="${C.hair}" stroke-width="1"/>`;
      }
      knots += `<g data-deeplink="practice/root_id/${esc(fam.id)}" data-family="${esc(fam.id)}" data-mastery="${f(fProg * 100) / 100}" `
        + `aria-label="${esc(fam.name)}, mastery ${fPct} percent. Go to practice.">`
        + `<title>${esc(fam.name)} — mastery ${fPct}% (your best scores). Click to practise.</title>`
        + `<circle cx="${f(k.x)}" cy="${f(k.y)}" r="${f(kr)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
        + leader
        + `<text x="${f(lxF)}" y="${f(lyF)}" text-anchor="${anchorF}" font-size="15" font-weight="500" fill="${C.ink}">${esc(fam.name)}</text>`
        + `</g>`;
    });
  });
  parts.push(labels);
  parts.push(knots);

  visualContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="display:block; width:100%; height:auto;" role="group" aria-label="Grammar root system">${parts.join('')}</svg>`;

  // Wire deep links: every interactive element navigates via the shareable hash,
  // so the tree, router and teacher links all use one mechanism.
  visualContainer.querySelectorAll('[data-deeplink]').forEach(el => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.style.cursor = 'pointer';
    const target = el.tagName === 'g' || el.tagName === 'G' ? el.querySelector('circle') : el;
    const go = () => {
      const dl = el.getAttribute('data-deeplink');
      if (window.location.hash === '#' + dl) routeHash();   // same link twice → still navigate
      else window.location.hash = dl;
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
    });
    const origStroke = target.getAttribute('stroke');
    const origW = target.getAttribute('stroke-width');
    el.addEventListener('focus', () => { target.setAttribute('stroke', C.ochre); target.setAttribute('stroke-width', '3'); });
    el.addEventListener('blur', () => { target.setAttribute('stroke', origStroke); target.setAttribute('stroke-width', origW); });
  });

}

// Quick placeholders for the new buttons (we can flesh these out)
document.getElementById('continueLastBtn')?.addEventListener('click', () => {
  // For now, just open the topic list as a reasonable default
  showMenuPanel('menuTopicSelect');
});

document.getElementById('practiceWeakBtn')?.addEventListener('click', () => {
  // Reuse existing weak spot logic if available
  const weak = getWeakSpotQuestions?.();
  if (weak && weak.length > 0) {
    // Launch weak spots quiz immediately (uses existing engine)
    state.quizMode = 'weak';
    state.currentQuestions = weak;
    state.currentIndex = 0;
    state.score = 0;
    state.wrongIndices = [];
    state.isRetryRound = false;
    document.getElementById('menuScreen').classList.add('hidden');
    document.body.classList.add('viewing-content');
    document.getElementById('quizScreen').classList.remove('hidden');
    document.getElementById('exitQuizBtn').textContent = 'Exit weak spots';
    showQuestion();
  } else {
    alert('No weak areas tracked yet (need 3+ wrong on a question with <3 correct). Do some practice first!');
  }
});

// === Global persistent nav wiring (simple + functional) ===
function updateNavContext(text) {
  const el = document.getElementById('navContext');
  if (el) el.textContent = text || '';
}

function goHome() {
  showMainMenu();
  updateNavContext('');
}

document.getElementById('navHomeBtn')?.addEventListener('click', () => {
  NAV.navigate('menuMain');
});
document.getElementById('navTopicsBtn')?.addEventListener('click', () => {
  state.returnToAfterTopicSelect = null;
  NAV.navigate('menuTopicSelect', { context: 'Topics' });
});
document.getElementById('navTreeBtn')?.addEventListener('click', () => {
  NAV.navigate('menuTreeOverview', { context: 'Grammar Tree' });
});
document.getElementById('navBackBtn')?.addEventListener('click', () => {
  NAV.back();
});

// Wire the new reference Main Menu button (added for harmonious util-bar consistency)
document.getElementById('referenceMainMenuBtn')?.addEventListener('click', () => {
  NAV.navigate('menuMain');
});

// Lightweight context updater for content screens (quiz/intro util bars)
function setContentContext(type, label) {
  const ctx = document.getElementById(type === 'quiz' ? 'quizContext' : 'introContext');
  if (ctx) ctx.innerHTML = label ? `<strong>${label}</strong>` : '';
}

// Very lightweight search (topics + pilot families)
let searchResultsEl = null;
function showNavSearchResults(matches) {
  const container = document.getElementById('navSearchResults');
  if (!container) return;
  container.innerHTML = '';
  if (!matches || !matches.length) {
    container.classList.add('hidden');
    return;
  }
  matches.forEach(m => {
    const btn = document.createElement('button');
    btn.textContent = m.label + (m.type === 'family' ? '  · family' : '');
    btn.style.cssText = 'background:#141414; color:#ccc; border:none; width:100%; text-align:left; padding:6px 10px; font-size:0.82rem;';
    btn.addEventListener('click', () => {
      container.classList.add('hidden');
      const input = document.getElementById('navSearchInput');
      if (input) input.value = '';
      if (m.type === 'topic' && m.id) {
        const idx = (state.topics || []).findIndex(t => t.id === m.id);
        if (idx >= 0) {
          state.currentTopic = state.topics[idx];
          applyTopic();
          showMenuPanel('menuTopicSelect');
          const sel = document.getElementById('topicSelect');
          if (sel) sel.value = String(idx);
          updateNavContext(m.label);
        }
      } else if (m.type === 'family' && m.id) {
        showTreeOverview();
        updateNavContext('Tree');
      }
    });
    container.appendChild(btn);
  });
  container.classList.remove('hidden');
}

function handleNavSearch(q) {
  const term = (q || '').trim().toLowerCase();
  if (!term || term.length < 2) {
    document.getElementById('navSearchResults')?.classList.add('hidden');
    return;
  }
  const results = [];

  // Topics from state
  (state.topics || []).forEach(t => {
    if ((t.title || t.id || '').toLowerCase().includes(term)) {
      results.push({ type: 'topic', id: t.id, label: toTitleCase(t.title || t.id) });
    }
  });

  // Pilot families (from loaded mapping)
  if (pilotMapping && pilotMapping.pilot_families) {
    pilotMapping.pilot_families.forEach(f => {
      if ((f.name || f.id || '').toLowerCase().includes(term)) {
        results.push({ type: 'family', id: f.id, label: f.name });
      }
    });
  }

  showNavSearchResults(results.slice(0, 8));
}

// Search is set up late (after data loads) so state.topics and pilotMapping are available
function setupSearch() {
  const input = document.getElementById('navSearchInput');
  const clearBtn = document.getElementById('navSearchClear');

  if (!input) {
    console.warn('navSearchInput not found in DOM');
    return;
  }

  // Attach listeners directly (simpler and more reliable)
  input.addEventListener('input', (e) => {
    handleNavSearch(e.target.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('navSearchResults')?.classList.add('hidden');
      e.target.value = '';
    }
    if (e.key === 'Enter') {
      const res = document.getElementById('navSearchResults');
      if (res && !res.classList.contains('hidden') && res.firstChild) {
        res.firstChild.click();
      }
    }
  });

  if (clearBtn) {
    clearBtn.onclick = () => {
      input.value = '';
      document.getElementById('navSearchResults')?.classList.add('hidden');
      input.focus();
    };
  }
}

// Nav context is updated explicitly from key flows (showMainMenu, topic select, tree, etc.)

// Load the new Grammar Tree model (hybrid approach)
let grammarTree = null;
let pilotMapping = null;

async function loadGrammarTree() {
  try {
    grammarTree = await fetchJSON('data/tree/tree.json');
  } catch (e) {
    console.warn('Could not load data/tree/tree.json — falling back to basic mode', e);
    grammarTree = null;
  }
}

async function loadPilotMapping() {
  try {
    pilotMapping = await fetchJSON('data/tree/pilot_families_mapping.json');
  } catch (e) {
    console.warn('Could not load pilot_families_mapping.json', e);
    pilotMapping = null;
  }
}

let rootContentIndex = null;

async function loadRootContentIndex() {
  try {
    rootContentIndex = await fetchJSON('data/tree/root_content_index.json');
  } catch (e) {
    console.warn('Could not load root_content_index.json — practice deep links disabled', e);
    rootContentIndex = null;
  }
}

// Topic page filter — module scope so it's visible to init()
function setupTopicFilter() {
  const filterInput = document.getElementById('topicFilterInput');
  const sel = document.getElementById('topicSelect');
  const resultsContainer = document.getElementById('topicSearchResults');

  if (!filterInput || !sel || !resultsContainer) return;

  filterInput.value = '';

  filterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && hasValidTopicSelected()) {
      e.preventDefault();
      document.getElementById('startPart1Btn').click();
    }
  });

  filterInput.addEventListener('input', () => {
    const term = filterInput.value.trim().toLowerCase();

    if (!term || term.length < 2) {
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      Array.from(sel.options).forEach(o => o.hidden = false);
      return;
    }

    const matches = [];

    (state.topics || []).forEach(t => {
      if ((t.title || t.id || '').toLowerCase().includes(term)) {
        matches.push({ type: 'topic', id: t.id, label: toTitleCase(t.title || t.id) });
      }
    });

    if (pilotMapping && pilotMapping.pilot_families) {
      pilotMapping.pilot_families.forEach(f => {
        if ((f.name || f.id || '').toLowerCase().includes(term)) {
          matches.push({ type: 'family', id: f.id, label: f.name });
        }
      });
    }

    if (matches.length === 0) {
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      return;
    }

    resultsContainer.innerHTML = '';

    matches.slice(0, 10).forEach(m => {
      const btn = document.createElement('button');
      btn.textContent = m.label + (m.type === 'family' ? '  · family' : '');
      btn.style.cssText = 'background:#141414; color:#ccc; border:none; width:100%; text-align:left; padding:6px 10px; font-size:0.85rem;';

      btn.addEventListener('click', () => {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        filterInput.value = '';

        if (m.type === 'topic' && m.id) {
          const idx = (state.topics || []).findIndex(t => t.id === m.id);
          if (idx >= 0) {
            sel.value = String(idx);
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else if (m.type === 'family') {
          showTreeOverview();
        }
      });

      resultsContainer.appendChild(btn);
    });

    resultsContainer.classList.remove('hidden');
  });

  const catSelect = document.getElementById('categorySelect');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      filterInput.value = '';
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      applyCategoryToTopicOptions(catSelect.value);
    });
  }
}

(async function init() {
  try {
    // App initialized (v42 fixes live)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          // Check for updates on load (helps keep things fresh on localhost)
          reg.update().catch(() => {});
        })
        .catch(function() {});
    }

    // Subtle force update link for when SW cache gets stuck
    document.getElementById('forceUpdateLink')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
      location.reload(true);
    });

    // Load Tree data early (for hybrid visible Tree features)
    await loadGrammarTree();
    await loadPilotMapping();
    await loadRootContentIndex();

    const mData = await fetchJSON('topics.json');
    if (mData) {
      state.topics = filterTopicsForMenu(mData.topics || []);
      if (state.topics.length > 0) {
        state.currentTopic = state.topics[0];
        const sel = document.getElementById('topicSelect');
        sel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '-1';
        placeholder.textContent = 'Choose a topic';
        placeholder.selected = true;
        sel.appendChild(placeholder);
        var completionMap = getTopicCompletionMap();
        state.topics.forEach((t, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          opt.dataset.topicId = t.id;
          var label = toTitleCase(t.title || t.id);
          if (completionMap[t.id]) label = '\u2713 ' + label;
          opt.textContent = label;
          sel.appendChild(opt);
        });
      }
    }
    await loadQuestions();
    renderMenu();
    setupSearch();
    setupTopicFilter();
    routeHash();

    // On initial load without a direct topic/practice hash, ensure we're on the home screen
    // with the Back button properly hidden (fixes regression on refresh)
    if (!window.location.hash || !(window.location.hash.startsWith('#topic/') || window.location.hash.startsWith('#practice/'))) {
      showMainMenu();
    }
  } catch (err) {
    // No fallback topic list: topics.json is the single source of truth.
    // Show an honest, actionable error instead of a stale copy of the data.
    console.error('App failed to initialise:', err);
    const notice = document.getElementById('deepLinkNotice');
    if (notice) {
      notice.textContent = 'Could not load the topic list (' + ((err && err.message) || 'unknown error') +
        '). Double-click start_server.bat and open http://localhost:8080, then reload this page.';
      notice.classList.remove('hidden');
    }
    const summaryEl = document.getElementById('scoresSummary');
    if (summaryEl) summaryEl.textContent = 'Could not load topics.json — the topic list is unavailable.';
    showMainMenu();
  }
})();

window.addEventListener('hashchange', routeHash);