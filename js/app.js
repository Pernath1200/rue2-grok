import state from './state.js';
import { STORAGE_KEY, MEMORY_KEY, REPORTED_QUESTIONS_KEY, migrateStorageKeys, loadScores, loadMemoryBank, saveMemoryBankEntry, saveScore, getLastBest, getProgressStats, getTopicCompletionMap, getReportedQuestions, questionHash } from './storage.js';
import { DATA_VERSION, SCREEN_IDS, MENU_PANEL_IDS, showScreen, showMenuPanel, openOverlay, closeOverlay, escapeAndBold, normalize, toTitleCase, shuffleArray, getBaseUrl, fetchJSON, renderScoreChart } from './ui.js';
import { registerCallbacks as registerCurrCallbacks, renderDiagram, showIntroSection, showWritingTipsIntroSection, startWritingTipsQuiz, startCourseSection, advanceCourseToNext, startPart1, startPart2, startDiagnostic, startMixedPractice, getCourseIntroSections } from './curriculum.js';
import { registerCallbacks as registerQuizCallbacks, startQuiz, startWeakSpotsQuiz, hasValidTopicSelected, syncCurrentTopicFromDropdown, getTopicTitle, getTopicLabelForDisplay, addReportedQuestion, addReportedIntroCard, getReportedReasonLabel, renderReportedQuestionsList, escapeHtml, cleanQuestionDisplay, showQuestion, submitAnswer, nextQuestion, finishQuiz, retryWrong } from './quiz.js';
import { registerCallbacks as registerRefCallbacks, renderPrepositionsListContent, prepositionsListAsText, showPrepositionsList, hidePrepositionsList, renderPhrasalVerbsDictionaryContent, phrasalVerbsDictionaryAsText, showPhrasalVerbsDictionary, hidePhrasalVerbsDictionary, renderReferenceIndex, showReferenceIndexFromIntro, renderReferencePrepositionsContent, showReferencePrepositions, renderReferenceOpenClozeContent, showReferenceOpenCloze, showOpenClozeRefFromIntro, showFixedPhrasesRefFromIntro, showReportedSpeechRefFromIntro, showInfinitiveIngRefFromIntro, showConjunctionsLinkersRefFromIntro, renderReferenceWordFormationContent, showReferenceWordFormation, renderReferenceConjunctionsLinkersContent, showReferenceConjunctionsLinkers, renderReferenceReportedSpeechContent, showReferenceReportedSpeech, renderReferenceIrregularVerbsContent, showReferenceIrregularVerbs, renderReferenceFixedPhrasesContent, showReferenceFixedPhrases, renderReferenceDependentSection, showReferenceDependentSection, dependentPrepositionsSectionAsText, renderReferenceCountableUncountableContent, showReferenceCountableUncountable, countableUncountableAsText, renderReferencePhrasalVerbsContent, showReferencePhrasalVerbs, renderReferenceInfinitiveIngContent, referenceAsText, showReference, showReferenceInfinitiveIng, renderReferenceModalVerbsContent, showReferenceModalVerbs, hideReference, onReferenceBackClick } from './reference.js';

migrateStorageKeys();
const COURSE_ORDER = ['check', 'gapfill', 'errorcorrection', 'makesentence', 'makequestion'];

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
document.getElementById('startPart2Btn').addEventListener('click', startPart2);
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
  document.getElementById('menuPracticeSetup').classList.add('hidden');
  document.getElementById('menuTopicSelect').classList.remove('hidden');
});
document.getElementById('practiceSetupMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('openTopicSelectBtn').addEventListener('click', () => { state.returnToAfterTopicSelect = null; showTopicSelectMenu(); });
document.getElementById('topicSelectMainMenuBtn').addEventListener('click', () => { state.returnToAfterTopicSelect = null; showMainMenu(); });
document.getElementById('topicSelectBackToPrevBtn').addEventListener('click', () => {
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
document.getElementById('diagnosticSetupMainMenuBtn').addEventListener('click', showMainMenu);
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
  document.getElementById('resultScreen').classList.add('hidden');
  document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('menuMain').classList.add('hidden');
  document.getElementById('menuTopicSelect').classList.add('hidden');
  document.getElementById('menuPracticeSetup').classList.remove('hidden');
  applyTopic();
  const topicEl = document.getElementById('practiceSetupTopic');
  if (topicEl) topicEl.textContent = state.currentTopic ? toTitleCase(state.currentTopic.title || state.currentTopic.id) : '';
});
document.getElementById('submitBtn').addEventListener('click', submitAnswer);
document.getElementById('nextBtn').addEventListener('click', nextQuestion);
document.getElementById('retryWrongBtn').addEventListener('click', retryWrong);
document.getElementById('backToMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('exitQuizBtn').addEventListener('click', () => {
  renderMenu();
});
document.getElementById('quizMainMenuBtn').addEventListener('click', showMainMenu);
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
    var menuScreen = document.getElementById('menuScreen');
    if (!menuScreen || menuScreen.classList.contains('hidden')) {
      e.preventDefault();
      showMainMenu();
    }
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
  showTreeOverview();
});

document.getElementById('treeOverviewBackBtn')?.addEventListener('click', () => {
  showMenuPanel('menuMain');
});

function showTreeOverview() {
  showMenuPanel('menuTreeOverview');
  renderSimpleTreeOverview();
}

function renderSimpleTreeOverview() {
  const container = document.getElementById('treeRootsList');
  if (!container) return;
  container.innerHTML = '';

  if (!grammarTree || !grammarTree.roots) {
    container.innerHTML = '<p style="color:var(--muted)">Tree model not loaded yet.</p>';
    return;
  }

  grammarTree.roots.forEach(root => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 0.6rem 0.75rem; background: var(--bg); border-radius: 6px; border: 1px solid rgba(86,95,137,0.3);';
    div.innerHTML = `
      <strong>${root.name}</strong>
      <div style="font-size:0.8rem; color:var(--muted); margin-top:2px;">${root.description || ''}</div>
    `;
    container.appendChild(div);
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
    // Could trigger weak spot quiz here later
    alert('Weak spot practice coming soon in the new dashboard!');
  } else {
    alert('No weak areas tracked yet. Do some practice first!');
  }
});

// Load the new Grammar Tree model (hybrid approach)
let grammarTree = null;

async function loadGrammarTree() {
  try {
    grammarTree = await fetchJSON('data/tree/tree.json');
    console.log('[Tree] Loaded Grammar Tree model v' + (grammarTree?.meta?.version || '?'));
  } catch (e) {
    console.warn('[Tree] Could not load data/tree/tree.json — falling back to basic mode', e);
    grammarTree = null;
  }
}

(async function init() {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function() {});
    }

    // Load Tree data early (for hybrid visible Tree features)
    await loadGrammarTree();

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
    applyHashAndShowTopic();
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
    applyHashAndShowTopic();
  }
})();

window.addEventListener('hashchange', applyHashAndShowTopic);