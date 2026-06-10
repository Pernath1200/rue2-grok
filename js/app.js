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
const EXCLUDED_TOPIC_MENU_IDS = new Set(['open_cloze', 'sentence_transformation']);
function filterTopicsForMenu(topics) {
  return (topics || []).filter(function (t) { return t && !EXCLUDED_TOPIC_MENU_IDS.has(t.id); });
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
  state.setsData = state.allQuestionsData[state.currentTopic.questions_key] || state.allQuestionsData.sets || {};
}

function applyTopic() {
  state.setsData = state.allQuestionsData[state.currentTopic.questions_key] || state.allQuestionsData.sets || {};
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

function applyHashAndShowTopic() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#topic\/([^/]+)$/);
  if (!match || !state.topics || !state.topics.length) return;
  const topicId = decodeURIComponent(match[1]);
  const idx = state.topics.findIndex(t => t.id === topicId);
  if (idx === -1) return;
  state.currentTopic = state.topics[idx];
  applyTopic();
  showScreen('menuScreen');
  showTopicSelectMenu();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
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

  // Real progress computation (defensive). Uses scores + completion + memory bank activity for tap_root lift.
  let rootProgress = {};
  let familyProgress = {};
  try {
    const bank = loadMemoryBank();
    const completionMap = getTopicCompletionMap();
    const stats = getProgressStats();

    grammarTree.roots.forEach(r => { rootProgress[r.id] = 0.26; });

    (pilotMapping.pilot_families || []).forEach(fam => {
      const rootId = fam.primary_root;
      if (!rootProgress[rootId]) return;

      let strength = 0.26;
      let counted = 0;

      (fam.current_topics || []).forEach(t => {
        const topicId = t.id;
        const lastBest = getLastBest(topicId);
        if (lastBest.best && lastBest.best[1] > 0) {
          strength += (lastBest.best[0] / lastBest.best[1]);
          counted++;
        } else if (completionMap[topicId]) {
          strength += 0.52;
          counted++;
        }
      });

      if (counted > 0) strength = strength / (counted + 1);
      const blended = Math.max(0.24, Math.min(0.91, strength));
      rootProgress[rootId] = Math.max(rootProgress[rootId], blended);
      familyProgress[fam.id] = blended;
    });

    // Stronger tap_root boost: memory bank activity + history volume + completion for pleasant real-data feel
    const hasAnyHistory = (loadScores().history || []).length > 0;
    const bankSize = Object.keys(bank || {}).length;
    const bankLift = Math.min(0.19, bankSize * 0.012);
    if (hasAnyHistory || bankSize > 0) {
      let tapBase = 0.59;
      if (bankSize >= 5 || stats.total >= 4) tapBase = 0.67;
      rootProgress.tap_root = Math.max(rootProgress.tap_root || 0.32, tapBase + bankLift);
    }
    // Mild overall lift when user has solid bank activity (helps non-pilot roots feel alive too)
    if (bankSize > 7) {
      Object.keys(rootProgress).forEach(k => {
        if (k !== 'tap_root') rootProgress[k] = Math.min(0.89, rootProgress[k] + 0.05);
      });
    }
  } catch (e) {
    console.warn('Tree progress calculation failed, using safe defaults:', e);
    rootProgress = {
      tap_root: 0.74,
      verb_phrase: 0.66,
      noun_phrase: 0.51,
      sentence_syntax: 0.40,
      clause_linking: 0.59,
      verb_complementation: 0.47,
      prepositions_particles: 0.55
    };
    familyProgress = {};
  }

  const width = 920;
  const height = 620;
  const centerX = width / 2;
  const baseY = 38;
  const maxRootLength = 410;

  const svgNS = "http://www.w3.org/2000/svg";
  let svg;
  try {
    svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.display = "block";
  } catch (e) {
    console.warn('SVG creation failed', e);
    visualContainer.innerHTML = '<div style="color:#888; padding:1rem;">Tree visual unavailable right now.</div>';
    return;
  }

  const cyan = "#569cd6";
  const cyanDark = "#3d7aa3";
  const cyanLight = "#7fb8e8";

  // Central tap root (strong vertical, thickness based on progress)
  const tapProgress = rootProgress.tap_root || 0.8;
  const tapThickness = 4 + tapProgress * 6; // 4px → 10px

  const tapRoot = document.createElementNS(svgNS, "line");
  tapRoot.setAttribute("x1", centerX);
  tapRoot.setAttribute("y1", baseY);
  tapRoot.setAttribute("x2", centerX);
  tapRoot.setAttribute("y2", baseY + maxRootLength * tapProgress);
  tapRoot.setAttribute("stroke", cyan);
  tapRoot.setAttribute("stroke-width", tapThickness);
  tapRoot.setAttribute("stroke-linecap", "round");
  svg.appendChild(tapRoot);

  // Define geometric lateral roots with controlled angles (larger canvas + scaled lengths for breathing room)
  const lateralRoots = [
    { rootId: "verb_phrase",         angle: -38, baseLength: 260, side: "left" },
    { rootId: "noun_phrase",         angle:  38, baseLength: 242, side: "right" },
    { rootId: "clause_linking",      angle: -22, baseLength: 295, side: "left" },
    { rootId: "prepositions_particles", angle:  22, baseLength: 278, side: "right" },
    { rootId: "verb_complementation", angle: -52, baseLength: 207, side: "left" },
    { rootId: "sentence_syntax",     angle:  52, baseLength: 195, side: "right" },
  ];

  // Small helper for clear multi-line labels on long family names (prevents overlap, keeps pleasant spacing)
  function appendMultilineLabel(labelEl, fullName) {
    labelEl.textContent = '';
    const maxLen = 17;
    let line1 = fullName;
    let line2 = '';
    if (fullName.length > maxLen) {
      const breakAt = fullName.lastIndexOf(' ', maxLen);
      if (breakAt > 6) {
        line1 = fullName.slice(0, breakAt);
        line2 = fullName.slice(breakAt + 1);
      } else if (fullName.includes(' & ')) {
        const parts = fullName.split(' & ');
        line1 = parts[0];
        line2 = '& ' + parts[1];
      }
    }
    const t1 = document.createElementNS(svgNS, 'tspan');
    t1.textContent = line1;
    labelEl.appendChild(t1);
    if (line2) {
      const t2 = document.createElementNS(svgNS, 'tspan');
      t2.textContent = line2;
      t2.setAttribute('x', labelEl.getAttribute('x') || '0');
      t2.setAttribute('dy', '1.15em');
      labelEl.appendChild(t2);
    }
  }

  lateralRoots.forEach(def => {
    const prog = rootProgress[def.rootId] || 0.5;
    const length = def.baseLength * (0.6 + prog * 0.55); // growth in depth
    const thickness = 2.5 + prog * 5.5;                   // growth in thickness

    const rad = (def.angle * Math.PI) / 180;
    const endX = centerX + Math.sin(rad) * length;
    const endY = baseY + Math.cos(rad) * length * 0.92;

    // Main lateral root
    const main = document.createElementNS(svgNS, "line");
    main.setAttribute("x1", centerX);
    main.setAttribute("y1", baseY + 50);
    main.setAttribute("x2", endX);
    main.setAttribute("y2", endY);
    main.setAttribute("stroke", cyan);
    main.setAttribute("stroke-width", thickness);
    main.setAttribute("stroke-linecap", "round");
    main.setAttribute("opacity", 0.95);
    svg.appendChild(main);

    // Small geometric sub-branches (more appear with higher progress) — scaled for large canvas
    const subCount = Math.floor(prog * 3);
    for (let i = 0; i < subCount; i++) {
      const t = 0.35 + i * 0.22;
      const sx = centerX + (endX - centerX) * t;
      const sy = (baseY + 50) + (endY - (baseY + 50)) * t;

      const subAngle = def.angle + (def.side === "left" ? -28 : 28) * (i % 2 === 0 ? 1 : -1);
      const subLen = 42 + prog * 27;
      const srad = (subAngle * Math.PI) / 180;

      const sub = document.createElementNS(svgNS, "line");
      sub.setAttribute("x1", sx);
      sub.setAttribute("y1", sy);
      sub.setAttribute("x2", sx + Math.sin(srad) * subLen);
      sub.setAttribute("y2", sy + Math.cos(srad) * subLen * 0.85);
      sub.setAttribute("stroke", cyanLight);
      sub.setAttribute("stroke-width", 1.5 + prog * 1.2);
      sub.setAttribute("stroke-linecap", "round");
      sub.setAttribute("opacity", 0.75);
      svg.appendChild(sub);
    }

    // Place families along this root (interactive nodes + labels)
    const families = familiesByRoot[def.rootId] || [];
    families.forEach((fam, idx) => {
      const t = 0.55 + idx * 0.18;
      const fx = centerX + (endX - centerX) * t;
      const fy = (baseY + 50) + (endY - (baseY + 50)) * t;

      const group = document.createElementNS(svgNS, "g");
      group.style.cursor = 'pointer';

      // Node: visually distinct by real progress (larger + brighter stroke for high-progress families)
      const fProg = familyProgress[fam.id] || prog || 0.48;
      const nodeR = (6.8 + fProg * 4.2).toFixed(1);
      const nStrokeW = (1.4 + fProg * 2.1).toFixed(1);
      const node = document.createElementNS(svgNS, "circle");
      node.setAttribute("cx", fx);
      node.setAttribute("cy", fy);
      node.setAttribute("r", nodeR);
      let nodeFill = cyan;
      let nodeStroke = "#0d0d0d";
      if (fProg > 0.71) {
        nodeFill = cyanLight;
        nodeStroke = cyanDark;
      } else if (fProg < 0.32) {
        node.setAttribute("opacity", "0.82");
      }
      node.setAttribute("fill", nodeFill);
      node.setAttribute("stroke", nodeStroke);
      node.setAttribute("stroke-width", nStrokeW);
      group.appendChild(node);

      // Label: stronger side-specific offset + stagger to guarantee zero overlap; <tspan> for long names
      const labelOffsetX = def.side === "left" ? -46 : 38;
      const labelStagger = idx * 17;
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", fx + labelOffsetX);
      label.setAttribute("y", fy + 3.5 + labelStagger);
      label.setAttribute("fill", "#e0f0ff");
      label.setAttribute("font-size", "14");
      label.setAttribute("font-family", "system-ui, sans-serif");
      label.setAttribute("text-anchor", def.side === "left" ? "end" : "start");
      appendMultilineLabel(label, fam.name);
      group.appendChild(label);

      // Accessibility + discoverability
      const title = document.createElementNS(svgNS, "title");
      title.textContent = `Practise: ${fam.name} (click to go to Topics)`;
      group.appendChild(title);

      // Click / keyboard activation + perfect focus highlight for SVG groups
      const activate = () => {
        navigateToFamilyTopics(fam);
      };
      group.addEventListener('click', activate);
      group.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(); }
      });
      const origStroke = node.getAttribute('stroke');
      const origStrokeW = node.getAttribute('stroke-width');
      group.addEventListener('focus', () => {
        node.setAttribute('stroke', cyanLight);
        node.setAttribute('stroke-width', '3');
      });
      group.addEventListener('blur', () => {
        node.setAttribute('stroke', origStroke);
        node.setAttribute('stroke-width', origStrokeW);
      });
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `Go to ${fam.name} topics`);

      svg.appendChild(group);
    });
  });

  // Minimal legend (honest, low-clutter) + tiny discoverability hint
  const legend = document.createElementNS(svgNS, "g");
  legend.setAttribute("transform", `translate(20, ${height - 46})`);
  const legLine = document.createElementNS(svgNS, "line");
  legLine.setAttribute("x1", 0); legLine.setAttribute("y1", 0);
  legLine.setAttribute("x2", 42); legLine.setAttribute("y2", 0);
  legLine.setAttribute("stroke", cyan); legLine.setAttribute("stroke-width", 6); legLine.setAttribute("stroke-linecap", "round");
  legend.appendChild(legLine);
  const legText = document.createElementNS(svgNS, "text");
  legText.setAttribute("x", 50); legText.setAttribute("y", 4);
  legText.setAttribute("fill", "#a0b8d8"); legText.setAttribute("font-size", "9");
  legText.textContent = "thicker = stronger (your real practice data)";
  legend.appendChild(legText);
  const hintText = document.createElementNS(svgNS, "text");
  hintText.setAttribute("x", 50); hintText.setAttribute("y", 14);
  hintText.setAttribute("fill", "#6a7c94"); hintText.setAttribute("font-size", "8");
  hintText.textContent = "click nodes to explore families";
  legend.appendChild(hintText);
  svg.appendChild(legend);

  // Tiny non-clutter top-right hint (reinforces without crowding roots/labels)
  const topHint = document.createElementNS(svgNS, "text");
  topHint.setAttribute("x", width - 168);
  topHint.setAttribute("y", 16);
  topHint.setAttribute("fill", "#5c6a80");
  topHint.setAttribute("font-size", "8.5");
  topHint.setAttribute("text-anchor", "end");
  topHint.textContent = "click any family";
  svg.appendChild(topHint);

  visualContainer.appendChild(svg);
}

// Helper: from tree click, go to Topics and pre-select a relevant topic from the family
function navigateToFamilyTopics(fam) {
  if (!fam || !fam.current_topics || !fam.current_topics.length) {
    NAV.navigate('menuTopicSelect', { context: fam?.name || 'Topics' });
    return;
  }
  const firstTopic = fam.current_topics[0];
  const idx = (state.topics || []).findIndex(t => t.id === firstTopic.id);
  if (idx >= 0) {
    state.currentTopic = state.topics[idx];
    applyTopic();
  }
  NAV.navigate('menuTopicSelect', { context: fam.name || 'Topics' });
  // After the panel renders, focus the first action button for immediate keyboard use
  setTimeout(() => {
    const firstBtn = document.getElementById('startPart1Btn');
    if (firstBtn) firstBtn.focus();
  }, 60);
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
      Array.from(sel.options).forEach(o => o.hidden = false);
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
    applyHashAndShowTopic();

    // On initial load without a direct topic hash, ensure we're on the home screen
    // with the Back button properly hidden (fixes regression on refresh)
    if (!window.location.hash || !window.location.hash.startsWith('#topic/')) {
      showMainMenu();
    }
  } catch (err) {
    state.topics = filterTopicsForMenu([
      { id: 'degree_adverbs', title: 'Adverbs: Degree and Intensifiers (very, really, too, so)', curriculum: 'curriculum_degree_adverbs.json', questions_key: 'degree_adverbs', root: 'outside_roots', secondary_root: null, cefr_levels: ['A2'] },
      { id: 'auxiliary_verbs', title: 'Auxiliary Verbs', curriculum: 'curriculum_auxiliary_verbs.json', questions_key: 'auxiliary_verbs', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A1', 'A2', 'B1'] },
      { id: 'comparatives', title: 'Comparatives and Superlatives', curriculum: 'curriculum_comparatives.json', questions_key: 'comparatives', root: 'noun_phrase', secondary_root: null, cefr_levels: ['A2', 'B2'] },
      { id: 'conjunctions_linkers', title: 'Conjunctions and Linkers', curriculum: 'curriculum_conjunctions_linkers.json', questions_key: 'conjunctions_linkers', root: 'clause_linking', secondary_root: null, cefr_levels: ['B1', 'B2'] },
      { id: 'articles', title: 'Determiners: Articles (a, an, the, ∅)', curriculum: 'curriculum_articles.json', questions_key: 'articles', root: 'noun_phrase', secondary_root: null, cefr_levels: ['A1', 'B1'] },
      { id: 'articles_advanced', title: 'Determiners: Articles — extension', curriculum: 'curriculum_articles_advanced.json', questions_key: 'articles_advanced', root: 'noun_phrase', secondary_root: null, cefr_levels: ['B2'] },
      { id: 'quantifiers', title: 'Determiners: Quantifiers', curriculum: 'curriculum_quantifiers.json', questions_key: 'quantifiers', root: 'noun_phrase', secondary_root: null, cefr_levels: ['A1', 'A2'] },
      { id: 'fixed_phrases', title: 'Fixed Phrases', curriculum: 'curriculum_fixed_phrases.json', questions_key: 'fixed_phrases', root: 'outside_roots', secondary_root: null, cefr_levels: [] },
      { id: 'modal_verbs', title: 'Modal Verbs', curriculum: 'curriculum_modal_verbs.json', questions_key: 'modal_verbs', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A1', 'A2', 'B1', 'B2'] },
      { id: 'countable_uncountable', title: 'Nouns: Uncountable and Always-Plural', curriculum: 'curriculum_countable_uncountable.json', questions_key: 'countable_uncountable', root: 'noun_phrase', secondary_root: null, cefr_levels: ['A2'] },
      { id: 'passives', title: 'Passives', curriculum: 'curriculum_passives.json', questions_key: 'passives', root: 'verb_phrase', secondary_root: null, cefr_levels: ['B1', 'B2'] },
      { id: 'phrasal_verbs', title: 'Phrasal Verbs', curriculum: 'curriculum_phrasal_verbs.json', questions_key: 'phrasal_verbs', root: 'verb_complementation', secondary_root: null, cefr_levels: ['B1', 'B2'] },
      { id: 'prepositions', title: 'Prepositions', curriculum: 'curriculum_prepositions.json', questions_key: 'prepositions', root: 'prepositions_particles', secondary_root: null, cefr_levels: ['A1', 'A2'] },
      { id: 'prepositions_dependent', title: 'Prepositions: Dependent', curriculum: 'curriculum_prepositions_dependent.json', questions_key: 'prepositions_dependent', root: 'prepositions_particles', secondary_root: null, cefr_levels: ['B2'] },
      { id: 'punctuation', title: 'Punctuation and Capitalisation', curriculum: 'curriculum_punctuation.json', questions_key: 'punctuation', root: 'outside_roots', secondary_root: null, cefr_levels: [] },
      { id: 'relative_pronouns', title: 'Relative Pronouns', curriculum: 'curriculum_relative_pronouns.json', questions_key: 'relative_pronouns', root: 'clause_linking', secondary_root: null, cefr_levels: ['A2', 'B1', 'B2'] },
      { id: 'reported_speech', title: 'Reported Speech', curriculum: 'curriculum_reported_speech.json', questions_key: 'reported_speech', root: 'clause_linking', secondary_root: 'verb_phrase', cefr_levels: ['B1', 'B2'] },
      { id: 'spelling', title: 'Spelling', curriculum: 'curriculum_spelling.json', questions_key: 'spelling', root: 'outside_roots', secondary_root: null, cefr_levels: [] },
      { id: 'conditionals', title: 'Tenses: Conditionals (Zero, First, Second, Third)', curriculum: 'curriculum_conditionals.json', questions_key: 'conditionals', root: 'clause_linking', secondary_root: 'verb_phrase', cefr_levels: ['A2', 'B1', 'B2'] },
      { id: 'tenses_general', title: 'Tenses: General', curriculum: 'curriculum_tenses_general.json', questions_key: 'tenses_general', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A1', 'A2', 'B1', 'B2'] },
      { id: 'past_perfect', title: 'Tenses: Past Perfect Simple and Past Perfect Continuous', curriculum: 'curriculum_past_perfect.json', questions_key: 'past_perfect', root: 'verb_phrase', secondary_root: null, cefr_levels: ['B1', 'B2'] },
      { id: 'past_simple_continuous', title: 'Tenses: Past Simple and Past Continuous', curriculum: 'curriculum_past_simple_continuous.json', questions_key: 'past_simple_continuous', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A1', 'A2'] },
      { id: 'past_simple_present_perfect', title: 'Tenses: Past Simple vs Present Perfect', curriculum: 'curriculum_past_simple_present_perfect.json', questions_key: 'past_simple_present_perfect', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A1', 'A2', 'B1'] },
      { id: 'present_perfect', title: 'Tenses: Present Perfect Simple vs Continuous', curriculum: 'curriculum.json', questions_key: 'sets', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A2', 'B1'] },
      { id: 'will_going_to', title: 'Tenses: Will and Going To', curriculum: 'curriculum_will_going_to.json', questions_key: 'will_going_to', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A2'] },
      { id: 'irregular_verbs', title: 'Verbs: Irregular Past Forms', curriculum: 'curriculum_irregular_verbs.json', questions_key: 'irregular_verbs', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A1', 'A2'] },
      { id: 'infinitive_ing', title: 'Verb Patterns: to-infinitive, -ing & bare infinitive', curriculum: 'curriculum_infinitive_ing.json', questions_key: 'infinitive_ing', root: 'verb_complementation', secondary_root: null, cefr_levels: ['A2', 'B1'] },
      { id: 'inversion', title: 'Inversion for emphasis', curriculum: 'curriculum_inversion.json', questions_key: 'inversion', root: 'sentence_ops', secondary_root: null, cefr_levels: ['B2'] },
      { id: 'it_subject', title: 'It – subject in English', curriculum: 'curriculum_it_subject.json', questions_key: 'it_subject', root: 'sentence_ops', secondary_root: null, cefr_levels: ['B1'] },
      { id: 'verb_subject_agreement', title: 'Verb–Subject Agreement', curriculum: 'curriculum_verb_subject_agreement.json', questions_key: 'verb_subject_agreement', root: 'verb_phrase', secondary_root: null, cefr_levels: ['A2', 'B1'] },
      { id: 'word_order', title: 'Word Order in Sentences', curriculum: 'curriculum_word_order.json', questions_key: 'word_order', root: 'tap_root', secondary_root: null, cefr_levels: ['A1', 'B2'] }
    ]);
    state.currentTopic = state.topics[0];
    const sel = document.getElementById('topicSelect');
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '-1';
    placeholder.textContent = 'Choose a topic';
    placeholder.selected = true;
    sel.appendChild(placeholder);
    state.topics.forEach((t, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = toTitleCase(t.title || t.id);
      sel.appendChild(opt);
    });
    document.getElementById('scoresSummary').textContent = 'Could not load topics.json. Topic list loaded from fallback. Double-click start_server.bat and open http://localhost:8080 for full features.';
    await loadQuestions().catch(function(e) {
      document.getElementById('scoresSummary').textContent += ' Questions failed to load: ' + (e && e.message || 'unknown error');
    });
    renderMenu();
    setupSearch();
    setupTopicFilter();
    applyHashAndShowTopic();

    // Ensure Back button is hidden on initial home screen in fallback mode too
    if (!window.location.hash || !window.location.hash.startsWith('#topic/')) {
      showMainMenu();
    }
  }
})();

window.addEventListener('hashchange', applyHashAndShowTopic);