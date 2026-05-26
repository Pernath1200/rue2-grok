import state from '../js/state.js';
import { STORAGE_KEY, MEMORY_KEY, REPORTED_QUESTIONS_KEY, migrateStorageKeys, loadScores, loadMemoryBank, saveMemoryBankEntry, saveScore, getLastBest, getProgressStats, getTopicCompletionMap, getReportedQuestions, questionHash } from '../js/storage.js';
import { DATA_VERSION, SCREEN_IDS, MENU_PANEL_IDS, showScreen, showMenuPanel, openOverlay, closeOverlay, escapeAndBold, normalize, toTitleCase, shuffleArray, getBaseUrl, fetchJSON, renderScoreChart, setFetchBaseToParent } from '../js/ui.js';
import { registerCallbacks as registerCurrCallbacks, renderDiagram, showIntroSection, showWritingTipsIntroSection, startWritingTipsQuiz, startCourseSection, advanceCourseToNext, startPart1, startPart2, startDiagnostic, startMixedPractice, getCourseIntroSections } from '../js/curriculum.js';
import { registerCallbacks as registerQuizCallbacks, startQuiz, startWeakSpotsQuiz, hasValidTopicSelected, syncCurrentTopicFromDropdown, getTopicTitle, getTopicLabelForDisplay, addReportedQuestion, getReportedReasonLabel, renderReportedQuestionsList, escapeHtml, cleanQuestionDisplay, showQuestion, submitAnswer, nextQuestion, finishQuiz, retryWrong } from '../js/quiz.js';
import { registerCallbacks as registerExamCallbacks, startExamClozeQuiz, startOpenClozeFreePractice, loadAndStartExamCloze, loadAndStartExamWordFormation, loadAndStartExamSentenceTransform, getCurrentExamTests, showExamTestSelectScreen, showExamClozeTestSelectScreen, startExamClozeTestByIndex, startExamTransformTestByIndex, renderExamClozeTest, submitExamClozeTest, onExamClozeNext, onExamClozeExit, renderExamTransformTest, submitExamTransformTest, onExamTransformNext, onExamTransformExit } from './exam.js';
import { registerCallbacks as registerRefCallbacks, renderPrepositionsListContent, prepositionsListAsText, showPrepositionsList, hidePrepositionsList, renderPhrasalVerbsDictionaryContent, phrasalVerbsDictionaryAsText, showPhrasalVerbsDictionary, hidePhrasalVerbsDictionary, renderReferenceIndex, showReferenceIndexFromIntro, renderReferencePrepositionsContent, showReferencePrepositions, renderReferenceOpenClozeContent, showReferenceOpenCloze, switchToReference, showOpenClozeRefFromIntro, showFixedPhrasesRefFromIntro, showReportedSpeechRefFromIntro, showConjunctionsLinkersRefFromIntro, renderReferenceWordFormationContent, showReferenceWordFormation, renderReferenceConjunctionsLinkersContent, showReferenceConjunctionsLinkers, renderReferenceReportedSpeechContent, showReferenceReportedSpeech, renderReferenceIrregularVerbsContent, showReferenceIrregularVerbs, renderReferenceFixedPhrasesContent, renderWritingTipsContent, showWritingTips, showReferenceFixedPhrases, renderReferenceDependentSection, showReferenceDependentSection, dependentPrepositionsSectionAsText, renderReferenceCountableUncountableContent, showReferenceCountableUncountable, countableUncountableAsText, renderReferencePhrasalVerbsContent, showReferencePhrasalVerbs, renderReferenceInfinitiveIngContent, referenceAsText, showReference, showReferenceInfinitiveIng, renderReferenceModalVerbsContent, showReferenceModalVerbs, hideReference, onReferenceBackClick } from '../js/reference.js';

migrateStorageKeys();
setFetchBaseToParent(true);
const COURSE_ORDER = ['check', 'gapfill', 'errorcorrection', 'makesentence', 'makequestion'];

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
  if (state.examMode === 'open_cloze') {
    showMenuPanel('menuOpenCloze');
  } else if (state.examMode === 'word_formation') {
    showMenuPanel('menuWordFormation');
  } else if (state.examMode === 'sentence_transformation') {
    showMenuPanel('menuSentenceTransform');
  } else {
    showMenuPanel('menuExamPractice');
  }
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
  document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
  document.getElementById('examTransformFeedbackBlock').classList.add('hidden');
  showTopicSelectMenu();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
}

function showTopicSelectMenu() {
  showMenuPanel('menuTopicSelect');
  const backToPrevBtn = document.getElementById('topicSelectBackToPrevBtn');
  if (backToPrevBtn) {
    if (state.returnToAfterTopicSelect === 'exam_cloze_feedback') {
      backToPrevBtn.classList.remove('hidden');
      backToPrevBtn.textContent = 'Back to exam answers';
    } else if (state.returnToAfterTopicSelect === 'diagnostic') {
      backToPrevBtn.classList.remove('hidden');
      backToPrevBtn.textContent = 'Back to test';
    } else if (state.returnToAfterTopicSelect === 'open_cloze_guided') {
      backToPrevBtn.classList.remove('hidden');
      backToPrevBtn.textContent = 'Back to Open Cloze';
    } else {
      backToPrevBtn.classList.add('hidden');
    }
  }
  if ((state.returnToAfterTopicSelect === 'diagnostic' || state.returnToAfterTopicSelect === 'open_cloze_guided') && state.currentTopic && state.topics && state.topics.length) {
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
  state.examMode = null;
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

function showExamPracticeMenu() {
  showMenuPanel('menuExamPractice');
}

function backToExamPracticeFromFeedback() {
  document.body.classList.remove('viewing-content');
  showScreen('menuScreen');
  document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
  document.getElementById('examTransformFeedbackBlock').classList.add('hidden');
  showExamPracticeMenu();
}

function showMainMenu() {
  showScreen('menuScreen');
  document.body.classList.remove('viewing-reference', 'viewing-content');
  state.examMode = null;
  showExamPracticeMenu();
}

function showOpenClozeMenu() {
  state.currentTopic = { id: 'open_cloze', title: 'Open Cloze', curriculum: 'curriculum_open_cloze.json' };
  state.examMode = 'open_cloze';
  showMenuPanel('menuOpenCloze');
}

function showOpenClozeModes() {
  showScreen('menuScreen');
  showMenuPanel('menuOpenCloze');
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
  state.examMode = null;
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
document.getElementById('topicSelectMainMenuBtn').addEventListener('click', () => { state.returnToAfterTopicSelect = null; showMainMenu(); });
document.getElementById('topicSelectBackToPrevBtn').addEventListener('click', () => {
  if (state.returnToAfterTopicSelect === 'exam_cloze_feedback') {
    document.getElementById('menuScreen').classList.add('hidden');
    document.body.classList.add('viewing-content');
    document.getElementById('examClozeTestScreen').classList.remove('hidden');
    document.getElementById('examClozeFeedbackBlock').classList.remove('hidden');
  } else if (state.returnToAfterTopicSelect === 'exam_transform_feedback') {
    document.getElementById('menuScreen').classList.add('hidden');
    document.body.classList.add('viewing-content');
    document.getElementById('examTransformTestScreen').classList.remove('hidden');
    document.getElementById('examTransformFeedbackBlock').classList.remove('hidden');
  } else if (state.returnToAfterTopicSelect === 'diagnostic' || state.returnToAfterTopicSelect === 'open_cloze_guided') {
    document.getElementById('menuScreen').classList.add('hidden');
    document.body.classList.add('viewing-content');
    document.getElementById('quizScreen').classList.remove('hidden');
  }
});
document.getElementById('examPracticeMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('examOpenClozeBtn').addEventListener('click', showOpenClozeMenu);
document.getElementById('examWritingTipsBtn').addEventListener('click', () => showWritingTips('exam_practice'));
document.getElementById('openClozePart1Btn').addEventListener('click', startPart1);
document.getElementById('openClozePart2Btn').addEventListener('click', startPart2);
document.getElementById('openClozeBackBtn').addEventListener('click', () => {
  state.examMode = null;
  document.getElementById('menuOpenCloze').classList.add('hidden');
  document.getElementById('menuExamPractice').classList.remove('hidden');
});
document.getElementById('openClozeMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('openClozeFurtherBtn').addEventListener('click', () => {
  document.getElementById('menuOpenCloze').classList.add('hidden');
  document.getElementById('menuOpenClozeStep3').classList.remove('hidden');
});
document.getElementById('openClozeStep3BackBtn').addEventListener('click', () => {
  document.getElementById('menuOpenClozeStep3').classList.add('hidden');
  document.getElementById('menuOpenCloze').classList.remove('hidden');
});
document.getElementById('openClozeStep3MainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('openClozePracticeTestsBtn').addEventListener('click', () => {
  document.getElementById('menuOpenClozeStep3').classList.add('hidden');
  document.getElementById('menuOpenClozeFurther').classList.remove('hidden');
});
document.getElementById('openClozeFreePracticeBtn').addEventListener('click', () => {
  document.getElementById('menuOpenClozeStep3').classList.add('hidden');
  document.getElementById('menuOpenClozeFreeSetup').classList.remove('hidden');
});
document.getElementById('openClozeFreeSetupBackBtn').addEventListener('click', () => {
  document.getElementById('menuOpenClozeFreeSetup').classList.add('hidden');
  document.getElementById('menuOpenClozeStep3').classList.remove('hidden');
});
document.getElementById('openClozeFreeSetupMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('openClozeFreeStartBtn').addEventListener('click', startOpenClozeFreePractice);
document.getElementById('openClozeFurtherBackBtn').addEventListener('click', () => {
  document.getElementById('menuOpenClozeFurther').classList.add('hidden');
  document.getElementById('menuOpenClozeStep3').classList.remove('hidden');
});
document.getElementById('openClozeFurtherMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('openClozeEasyBtn').addEventListener('click', () => loadAndStartExamCloze('easy'));
document.getElementById('openClozeMediumBtn').addEventListener('click', () => loadAndStartExamCloze('medium'));
document.getElementById('openClozeHardBtn').addEventListener('click', () => loadAndStartExamCloze('hard'));
document.getElementById('openClozeExpertBtn').addEventListener('click', () => loadAndStartExamCloze('expert'));
const examClozeTestSelectBackBtn = document.getElementById('examClozeTestSelectBackBtn');
if (examClozeTestSelectBackBtn) examClozeTestSelectBackBtn.addEventListener('click', () => {
  document.getElementById('menuExamClozeTestSelect').classList.add('hidden');
  document.getElementById('menuOpenCloze').classList.add('hidden');
  document.getElementById('menuOpenClozeFurther').classList.add('hidden');
  document.getElementById('menuWordFormation').classList.add('hidden');
  document.getElementById('menuSentenceTransform').classList.add('hidden');
  document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
    if (state.currentExamSubMenu === 'word_formation') {
      document.getElementById('menuWordFormationFurther').classList.add('hidden');
      document.getElementById('menuWordFormation').classList.remove('hidden');
    } else if (state.currentExamSubMenu === 'sentence_transformation') {
      document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
      document.getElementById('menuSentenceTransform').classList.remove('hidden');
    } else {
      document.getElementById('menuOpenClozeFurther').classList.add('hidden');
      document.getElementById('menuOpenCloze').classList.remove('hidden');
    }
});
const examClozeTestSelectMainMenuBtn = document.getElementById('examClozeTestSelectMainMenuBtn');
if (examClozeTestSelectMainMenuBtn) examClozeTestSelectMainMenuBtn.addEventListener('click', showMainMenu);
const examClozeTestSelectList = document.getElementById('examClozeTestSelectList');
if (examClozeTestSelectList) examClozeTestSelectList.addEventListener('click', function(e) {
  const btn = e.target && e.target.closest && e.target.closest('button[data-index]');
  if (!btn) return;
  const tests = getCurrentExamTests();
  if (!tests || tests.length === 0) return;
  const index = parseInt(btn.dataset.index, 10);
  if (isNaN(index) || index < 0 || index >= tests.length) return;
  if (state.currentExamType === 'sentence_transformation') startExamTransformTestByIndex(index);
  else startExamClozeTestByIndex(index);
});
const examClozeTestSelectRandomBtn = document.getElementById('examClozeTestSelectRandomBtn');
if (examClozeTestSelectRandomBtn) examClozeTestSelectRandomBtn.addEventListener('click', () => {
  const tests = getCurrentExamTests();
  if (!tests || tests.length === 0) return;
  const index = Math.floor(Math.random() * tests.length);
  if (state.currentExamType === 'sentence_transformation') startExamTransformTestByIndex(index);
  else startExamClozeTestByIndex(index);
});
const examClozeBackToTestListBtn = document.getElementById('examClozeBackToTestListBtn');
if (examClozeBackToTestListBtn) examClozeBackToTestListBtn.addEventListener('click', showExamClozeTestSelectScreen);
const examClozeBackToExamPracticeBtn = document.getElementById('examClozeBackToExamPracticeBtn');
if (examClozeBackToExamPracticeBtn) examClozeBackToExamPracticeBtn.addEventListener('click', backToExamPracticeFromFeedback);
document.getElementById('openClozeModesBackBtn').addEventListener('click', () => {
  document.getElementById('menuOpenClozeModes').classList.add('hidden');
  document.getElementById('menuOpenCloze').classList.remove('hidden');
});
document.getElementById('openClozeModesMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('examClozeSubmitBtn').addEventListener('click', submitExamClozeTest);
document.getElementById('examClozeNextBtn').addEventListener('click', onExamClozeNext);
document.getElementById('examClozeExitBtn').addEventListener('click', onExamClozeExit);
document.getElementById('examClozeMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('examClozeFeedbackMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('examClozeFeedbackBlock').addEventListener('click', function(e) {
  const link = e.target && e.target.closest('.exam-cloze-topic-link');
  if (!link) return;
  e.preventDefault();
  const topicId = link.getAttribute('data-topic-id');
  if (!topicId || !state.topics || !state.topics.length) return;
  const idx = state.topics.findIndex(t => t.id === topicId);
  if (idx === -1) return;
  state.currentTopic = state.topics[idx];
  applyTopic();
  state.returnToAfterTopicSelect = 'exam_cloze_feedback';
  location.hash = 'topic/' + topicId;
  document.getElementById('examClozeTestScreen').classList.add('hidden');
  document.getElementById('examClozeFeedbackBlock').classList.add('hidden');
  document.getElementById('menuScreen').classList.remove('hidden');
  showTopicSelectMenu();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
});
function showWordFormationMenu() {
  document.getElementById('menuExamPractice').classList.add('hidden');
  document.getElementById('menuOpenCloze').classList.add('hidden');
  document.getElementById('menuOpenClozeFurther').classList.add('hidden');
  document.getElementById('menuSentenceTransform').classList.add('hidden');
  document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
  document.getElementById('menuWordFormationFurther').classList.add('hidden');
  document.getElementById('menuWordFormation').classList.remove('hidden');
}
function showSentenceTransformMenu() {
  document.getElementById('menuExamPractice').classList.add('hidden');
  document.getElementById('menuOpenCloze').classList.add('hidden');
  document.getElementById('menuOpenClozeFurther').classList.add('hidden');
  document.getElementById('menuWordFormation').classList.add('hidden');
  document.getElementById('menuWordFormationFurther').classList.add('hidden');
  document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
  document.getElementById('menuSentenceTransform').classList.remove('hidden');
}
document.getElementById('examWordFormationBtn').addEventListener('click', showWordFormationMenu);
document.getElementById('examSentenceTransformationBtn').addEventListener('click', showSentenceTransformMenu);
document.getElementById('wordFormationPart1Btn').addEventListener('click', () => {
  state.currentTopic = { id: 'word_formation', title: 'Word Formation', curriculum: 'curriculum_word_formation.json' };
  state.examMode = 'word_formation';
  startPart1();
});
document.getElementById('wordFormationPart2Btn').addEventListener('click', () => {
  state.currentTopic = { id: 'word_formation', title: 'Word Formation', curriculum: 'curriculum_word_formation.json' };
  state.examMode = 'word_formation';
  startPart2();
});
document.getElementById('wordFormationFurtherBtn').addEventListener('click', () => {
  document.getElementById('menuWordFormation').classList.add('hidden');
  document.getElementById('menuWordFormationFurther').classList.remove('hidden');
});
document.getElementById('wordFormationFurtherBackBtn').addEventListener('click', () => {
  document.getElementById('menuWordFormationFurther').classList.add('hidden');
  document.getElementById('menuWordFormation').classList.remove('hidden');
});
document.getElementById('wordFormationFurtherMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('sentenceTransformFurtherBtn').addEventListener('click', () => {
  document.getElementById('menuSentenceTransform').classList.add('hidden');
  document.getElementById('menuSentenceTransformFurther').classList.remove('hidden');
});
document.getElementById('sentenceTransformFurtherBackBtn').addEventListener('click', () => {
  document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
  document.getElementById('menuSentenceTransform').classList.remove('hidden');
});
document.getElementById('sentenceTransformFurtherMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('sentenceTransformPart1Btn').addEventListener('click', () => {
  state.currentTopic = { id: 'sentence_transformation', title: 'Sentence Transformation', curriculum: 'curriculum_sentence_transformation.json' };
  state.examMode = 'sentence_transformation';
  startPart1();
});
document.getElementById('sentenceTransformPart2Btn').addEventListener('click', () => {
  state.currentTopic = { id: 'sentence_transformation', title: 'Sentence Transformation', curriculum: 'curriculum_sentence_transformation.json' };
  state.examMode = 'sentence_transformation';
  startPart2();
});
document.getElementById('wordFormationEasyBtn').addEventListener('click', () => loadAndStartExamWordFormation('easy'));
document.getElementById('wordFormationMediumBtn').addEventListener('click', () => loadAndStartExamWordFormation('medium'));
document.getElementById('wordFormationHardBtn').addEventListener('click', () => loadAndStartExamWordFormation('hard'));
document.getElementById('wordFormationExpertBtn').addEventListener('click', () => loadAndStartExamWordFormation('expert'));
document.getElementById('wordFormationBackBtn').addEventListener('click', () => {
  document.getElementById('menuWordFormation').classList.add('hidden');
  document.getElementById('menuExamPractice').classList.remove('hidden');
});
document.getElementById('wordFormationMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('sentenceTransformEasyBtn').addEventListener('click', () => loadAndStartExamSentenceTransform('easy'));
document.getElementById('sentenceTransformMediumBtn').addEventListener('click', () => loadAndStartExamSentenceTransform('medium'));
document.getElementById('sentenceTransformHardBtn').addEventListener('click', () => loadAndStartExamSentenceTransform('hard'));
document.getElementById('sentenceTransformExpertBtn').addEventListener('click', () => loadAndStartExamSentenceTransform('expert'));
document.getElementById('sentenceTransformBackBtn').addEventListener('click', () => {
  document.getElementById('menuSentenceTransform').classList.add('hidden');
  document.getElementById('menuExamPractice').classList.remove('hidden');
});
document.getElementById('sentenceTransformMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('examTransformSubmitBtn').addEventListener('click', submitExamTransformTest);
document.getElementById('examTransformNextBtn').addEventListener('click', onExamTransformNext);
document.getElementById('examTransformBackToTestListBtn').addEventListener('click', showExamTestSelectScreen);
document.getElementById('examTransformBackToExamPracticeBtn').addEventListener('click', backToExamPracticeFromFeedback);
document.getElementById('examTransformExitBtn').addEventListener('click', onExamTransformExit);
document.getElementById('examTransformMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('examTransformFeedbackMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('examTransformFeedbackBlock').addEventListener('click', function(e) {
  const link = e.target && e.target.closest('.exam-cloze-topic-link');
  if (!link) return;
  e.preventDefault();
  const topicId = link.getAttribute('data-topic-id');
  if (!topicId || !state.topics || !state.topics.length) return;
  const idx = state.topics.findIndex(t => t.id === topicId);
  if (idx === -1) return;
  state.currentTopic = state.topics[idx];
  applyTopic();
  state.returnToAfterTopicSelect = 'exam_transform_feedback';
  location.hash = 'topic/' + topicId;
  document.getElementById('examTransformTestScreen').classList.add('hidden');
  document.getElementById('examTransformFeedbackBlock').classList.add('hidden');
  document.getElementById('menuScreen').classList.remove('hidden');
  showTopicSelectMenu();
  const sel = document.getElementById('topicSelect');
  if (sel) sel.value = String(idx);
});
document.getElementById('openDiagnosticSetupBtn').addEventListener('click', () => {
  document.getElementById('menuMain').classList.add('hidden');
  document.getElementById('menuTopicSelect').classList.add('hidden');
  document.getElementById('menuExamPractice').classList.add('hidden');
  document.getElementById('menuOpenCloze').classList.add('hidden');
  document.getElementById('menuOpenClozeStep3').classList.add('hidden');
  document.getElementById('menuOpenClozeFreeSetup').classList.add('hidden');
  document.getElementById('menuOpenClozeFurther').classList.add('hidden');
  document.getElementById('menuWordFormation').classList.add('hidden');
  document.getElementById('menuWordFormationFurther').classList.add('hidden');
  document.getElementById('menuSentenceTransform').classList.add('hidden');
  document.getElementById('menuSentenceTransformFurther').classList.add('hidden');
  document.getElementById('menuOpenClozeModes').classList.add('hidden');
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
      showExamPracticeMenu();
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
document.getElementById('diagnosticExamPracticeBtn').addEventListener('click', () => {
  document.getElementById('resultScreen').classList.add('hidden');
  document.body.classList.remove('viewing-content');
  document.getElementById('menuScreen').classList.remove('hidden');
  showExamPracticeMenu();
});
document.getElementById('resultBackToExamPracticeBtn').addEventListener('click', () => {
  document.getElementById('resultScreen').classList.add('hidden');
  document.body.classList.remove('viewing-content');
  document.getElementById('menuScreen').classList.remove('hidden');
  showExamPracticeMenu();
});
document.getElementById('resultViewFullWritingTipsBtn').addEventListener('click', () => {
  document.getElementById('resultScreen').classList.add('hidden');
  document.body.classList.remove('viewing-content');
  if (state.writingTipsData) {
    state.referenceReturnTo = 'exam_practice';
    state.referenceView = 'writing_tips';
    renderWritingTipsContent(state.writingTipsData);
    document.getElementById('referenceBackBtn').textContent = 'Back to Exam Practice';
    switchToReference('exam_practice');
  }
});
document.getElementById('exitQuizBtn').addEventListener('click', () => {
  if (state.quizMode === 'writing_tips') {
    document.body.classList.remove('viewing-content');
    showScreen('menuScreen');
    showExamPracticeMenu();
  } else {
    renderMenu();
  }
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
  state.returnToAfterTopicSelect = (state.quizMode === 'diagnostic') ? 'diagnostic' : (state.coursePart === 2 && state.examMode === 'open_cloze') ? 'open_cloze_guided' : 'diagnostic';
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
document.getElementById('phrasalVerbsDictionaryBackBtn').addEventListener('click', hidePhrasalVerbsDictionary);
document.getElementById('phrasalVerbsDictionaryMainMenuBtn').addEventListener('click', showMainMenu);
document.getElementById('phrasalVerbsDictionaryPrintBtn').addEventListener('click', () => window.print());
document.getElementById('openReferenceBtn').addEventListener('click', showReference);
document.getElementById('referenceBackBtn').addEventListener('click', onReferenceBackClick);
document.getElementById('reportQuestionBtn').addEventListener('click', function() {
  if (!state.currentQuestions.length || state.currentIndex < 0 || state.currentIndex >= state.currentQuestions.length) return;
  var input = document.getElementById('flagReasonInput');
  if (input) input.value = '';
  openOverlay('flagReasonOverlay', this);
});
document.getElementById('flagReasonSubmitBtn').addEventListener('click', function() {
  var reasonText = (document.getElementById('flagReasonInput').value || '').trim();
  addReportedQuestion('', reasonText);
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
  const text = list.length === 0 ? 'No flagged questions.' : list.map(function(r) {
    const reason = getReportedReasonLabel(r);
    return '---\nTopic: ' + (r.topicTitle || r.topicId || '—') + '\nSource: ' + (r.source || '—') + '\nDate: ' + (r.timestamp ? new Date(r.timestamp).toLocaleString() : '—') + (reason !== '—' ? '\nReason: ' + reason : '') + '\nQuestion: ' + (r.questionText || '');
  }).join('\n\n');
  navigator.clipboard.writeText(text).then(function() { document.getElementById('reportedQuestionsCopyBtn').textContent = 'Copied!'; setTimeout(function() { document.getElementById('reportedQuestionsCopyBtn').textContent = 'Copy all to clipboard'; }, 1500); }).catch(function() {});
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

  if (e.key === 'Enter' && !e.defaultPrevented) {
    var el = e.target;
    if (!el || !el.isContentEditable) {
      var tag = el && el.tagName;
      var skipEnter = tag === 'TEXTAREA' || (tag === 'INPUT' && (!el.type || (el.type !== 'button' && el.type !== 'submit' && el.type !== 'reset')));
      if (!skipEnter && !(el && el.closest && el.closest('[role="dialog"]'))) {
        var introSc = document.getElementById('introScreen');
        if (introSc && !introSc.classList.contains('hidden')) {
          e.preventDefault();
          document.getElementById('introNextBtn').click();
          return;
        }
        var secSc = document.getElementById('sectionCompleteScreen');
        if (secSc && !secSc.classList.contains('hidden')) {
          e.preventDefault();
          document.getElementById('sectionCompleteNextBtn').click();
          return;
        }
        var resSc = document.getElementById('resultScreen');
        if (resSc && !resSc.classList.contains('hidden')) {
          var retryEl = document.getElementById('retryWrongBtn');
          if (retryEl && !retryEl.classList.contains('hidden')) {
            e.preventDefault();
            retryEl.click();
            return;
          }
          e.preventDefault();
          document.getElementById('backToMenuBtn').click();
          return;
        }
      }
    }
  }

  var quizScreen = document.getElementById('quizScreen');
  if (!quizScreen || quizScreen.classList.contains('hidden')) return;
  var fb = document.getElementById('feedbackBlock');
  var feedbackVisible = fb && !fb.classList.contains('hidden');
  var q = state.currentQuestions && state.currentQuestions[state.currentIndex];
  if (!q) return;

  if (e.key === 'Enter') {
    if (feedbackVisible) {
      e.preventDefault();
      document.getElementById('nextBtn').click();
      return;
    }
    if (q.type === 'mc' && state.selectedMc != null) { e.preventDefault(); submitAnswer(); return; }
    if (q.type !== 'mc') { e.preventDefault(); document.getElementById('submitBtn').click(); return; }
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

// state.deferredInstallPrompt now in state.js
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  state.deferredInstallPrompt = e;
  var btn = document.getElementById('installBtn');
  if (btn) btn.classList.remove('hidden');
});
window.addEventListener('appinstalled', function() {
  state.deferredInstallPrompt = null;
  var btn = document.getElementById('installBtn');
  if (btn) btn.classList.add('hidden');
});

registerRefCallbacks({ showExamPracticeMenu, showWritingTipsIntroSection });
registerCurrCallbacks({ showQuestion, loadCurriculumData, loadQuestions, hasValidTopicSelected, syncCurrentTopicFromDropdown, getTopicTitle, renderMenu });
registerExamCallbacks({ showQuestion, showMainMenu, getTopicTitle, getTopicLabelForDisplay, answerMatches });
registerQuizCallbacks({ renderMenu, advanceCourseToNext, getWeakSpotQuestions, applyTopic, answerMatches, openTopicIntroFromResults });

(async function init() {
  try {
    var savedTheme = null;
    try { savedTheme = localStorage.getItem('rue2_theme'); } catch (e) {}
    if (savedTheme !== null) applyTheme(savedTheme);
    document.getElementById('themeToggle').addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      applyTheme(btn.dataset.theme);
    });
    document.getElementById('installBtn').addEventListener('click', function() {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      state.deferredInstallPrompt.userChoice.then(function() { state.deferredInstallPrompt = null; });
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function() {});
    }
    const mData = await fetchJSON('topics.json');
    if (mData) {
      state.topics = mData.topics || [];
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
    state.topics = [
      { id: 'auxiliary_verbs', title: 'Auxiliary Verbs', curriculum: 'curriculum_auxiliary_verbs.json', questions_key: 'auxiliary_verbs' },
      { id: 'comparatives', title: 'Comparatives and Superlatives', curriculum: 'curriculum_comparatives.json', questions_key: 'comparatives' },
      { id: 'conjunctions_linkers', title: 'Conjunctions and Linkers', curriculum: 'curriculum_conjunctions_linkers.json', questions_key: 'conjunctions_linkers' },
      { id: 'articles', title: 'Determiners: Articles (a, an, the, ∅)', curriculum: 'curriculum_articles.json', questions_key: 'articles' },
      { id: 'quantifiers', title: 'Determiners: Quantifiers', curriculum: 'curriculum_quantifiers.json', questions_key: 'quantifiers' },
      { id: 'fixed_phrases', title: 'Fixed Phrases', curriculum: 'curriculum_fixed_phrases.json', questions_key: 'fixed_phrases' },
      { id: 'modal_verbs', title: 'Modal Verbs', curriculum: 'curriculum_modal_verbs.json', questions_key: 'modal_verbs' },
      { id: 'countable_uncountable', title: 'Nouns: Uncountable and Always-Plural', curriculum: 'curriculum_countable_uncountable.json', questions_key: 'countable_uncountable' },
      { id: 'passives', title: 'Passives', curriculum: 'curriculum_passives.json', questions_key: 'passives' },
      { id: 'phrasal_verbs', title: 'Phrasal Verbs', curriculum: 'curriculum_phrasal_verbs.json', questions_key: 'phrasal_verbs' },
      { id: 'prepositions', title: 'Prepositions', curriculum: 'curriculum_prepositions.json', questions_key: 'prepositions' },
      { id: 'prepositions_dependent', title: 'Prepositions: Dependent', curriculum: 'curriculum_prepositions_dependent.json', questions_key: 'prepositions_dependent' },
      { id: 'punctuation', title: 'Punctuation and Capitalisation', curriculum: 'curriculum_punctuation.json', questions_key: 'punctuation' },
      { id: 'relative_pronouns', title: 'Relative Pronouns', curriculum: 'curriculum_relative_pronouns.json', questions_key: 'relative_pronouns' },
      { id: 'reported_speech', title: 'Reported Speech', curriculum: 'curriculum_reported_speech.json', questions_key: 'reported_speech' },
      { id: 'spelling', title: 'Spelling', curriculum: 'curriculum_spelling.json', questions_key: 'spelling' },
      { id: 'conditionals', title: 'Tenses: Conditionals (Zero, First, Second, Third)', curriculum: 'curriculum_conditionals.json', questions_key: 'conditionals' },
      { id: 'tenses_general', title: 'Tenses: General', curriculum: 'curriculum_tenses_general.json', questions_key: 'tenses_general' },
      { id: 'past_perfect', title: 'Tenses: Past Perfect Simple and Past Perfect Continuous', curriculum: 'curriculum_past_perfect.json', questions_key: 'past_perfect' },
      { id: 'past_simple_continuous', title: 'Tenses: Past Simple and Past Continuous', curriculum: 'curriculum_past_simple_continuous.json', questions_key: 'past_simple_continuous' },
      { id: 'past_simple_present_perfect', title: 'Tenses: Past Simple vs Present Perfect', curriculum: 'curriculum_past_simple_present_perfect.json', questions_key: 'past_simple_present_perfect' },
      { id: 'present_perfect', title: 'Tenses: Present Perfect Simple vs Continuous', curriculum: 'curriculum.json', questions_key: 'sets' },
      { id: 'will_going_to', title: 'Tenses: Will and Going To', curriculum: 'curriculum_will_going_to.json', questions_key: 'will_going_to' },
      { id: 'infinitive_ing', title: 'Verb Patterns: to-infinitive, -ing & bare infinitive', curriculum: 'curriculum_infinitive_ing.json', questions_key: 'infinitive_ing' },
      { id: 'inversion', title: 'Inversion for emphasis', curriculum: 'curriculum_inversion.json', questions_key: 'inversion' },
      { id: 'it_subject', title: 'It – subject in English', curriculum: 'curriculum_it_subject.json', questions_key: 'it_subject' },
      { id: 'verb_subject_agreement', title: 'Verb–Subject Agreement', curriculum: 'curriculum_verb_subject_agreement.json', questions_key: 'verb_subject_agreement' },
      { id: 'word_order', title: 'Word Order in Sentences', curriculum: 'curriculum_word_order.json', questions_key: 'word_order' }
    ];
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