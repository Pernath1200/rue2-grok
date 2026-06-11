import state, { PART2_ORDER } from './state.js';
import { showScreen, showMenuPanel, fetchJSON, escapeAndBold, renderIntroContentHtml } from './ui.js';
import { switchToReference } from './reference.js';
import { saveLastActivity } from './storage.js';

let _showQuestion = null;
let _loadCurriculumData = null;
let _loadQuestions = null;
let _hasValidTopicSelected = null;
let _syncCurrentTopicFromDropdown = null;
let _getTopicTitle = null;
let _renderMenu = null;

export function registerCallbacks(callbacks) {
  _showQuestion = callbacks.showQuestion;
  _loadCurriculumData = callbacks.loadCurriculumData;
  _loadQuestions = callbacks.loadQuestions;
  _hasValidTopicSelected = callbacks.hasValidTopicSelected;
  _syncCurrentTopicFromDropdown = callbacks.syncCurrentTopicFromDropdown;
  _getTopicTitle = callbacks.getTopicTitle;
  _renderMenu = callbacks.renderMenu;
}

export function renderDiagram(diagramData) {
  if (!diagramData || !diagramData.type) return '';
  const esc = (s) => escapeAndBold(s || '');
  const titleHtml = diagramData.title ? '<div class="diagram-title">' + esc(diagramData.title) + '</div>' : '';

  if (diagramData.type === 'table') {
    const headers = diagramData.headers || [];
    const rows = diagramData.rows || [];
    let html = '<div class="diagram">' + titleHtml + '<table class="diagram-table"><thead><tr>';
    headers.forEach(h => { html += '<th>' + esc(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      const cells = Array.isArray(row) ? row : (row.cells || []);
      const hl = !Array.isArray(row) && row.highlight;
      html += '<tr>';
      cells.forEach((c, ci) => {
        html += '<td' + (hl || ci === 0 ? ' class="dt-highlight"' : '') + '>' + esc(c) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  if (diagramData.type === 'formula') {
    const items = diagramData.items || [];
    let html = '<div class="diagram">' + titleHtml + '<div class="diagram-formula">';
    items.forEach(item => {
      const label = item.label ? '<span class="diagram-formula-label">' + esc(item.label) + '</span>' : '';
      const formula = (item.formula || '').replace(/→/g, '<span class="diagram-formula-arrow">→</span>');
      html += '<div class="diagram-formula-item">' + label + esc(formula).replace(/→/g, '<span class="diagram-formula-arrow">→</span>') + '</div>';
    });
    html += '</div></div>';
    return html;
  }

  if (diagramData.type === 'comparison') {
    const left = diagramData.left || {};
    const right = diagramData.right || {};
    let html = '<div class="diagram">' + titleHtml + '<div class="diagram-comparison">';
    [left, right].forEach(col => {
      html += '<div class="diagram-comparison-col"><h4>' + esc(col.title || '') + '</h4>';
      if (col.points && col.points.length) {
        html += '<ul>';
        col.points.forEach(p => { html += '<li>' + esc(p) + '</li>'; });
        html += '</ul>';
      }
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  if (diagramData.type === 'timeline') {
    const events = diagramData.events || [];
    let html = '<div class="diagram">' + titleHtml + '<div class="diagram-timeline">';
    events.forEach(ev => {
      const markerClass = ev.style === 'past' ? 'tl-past' : ev.style === 'now' ? 'tl-now' : ev.style === 'future' ? 'tl-future' : '';
      html += '<div class="diagram-timeline-point">';
      html += '<div class="diagram-timeline-marker ' + markerClass + '"></div>';
      html += '<div class="diagram-timeline-label">' + esc(ev.label || '') + '</div>';
      if (ev.detail) html += '<div class="diagram-timeline-detail">' + esc(ev.detail) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  return '';
}

function scheduleIntroOverflowCheck(sectionTitle) {
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      const el = document.querySelector('#introScreen .intro-content-scroll');
      if (!el) return;
      if (el.scrollHeight > el.clientHeight + 1) {
        console.warn('[Intro overflow] Card content exceeds visible area — split into multiple intro sections. Title: ' + (sectionTitle || '(untitled)'));
      }
    });
  });
}

/** Intro cards for the current topic: `courseCurriculum.intro.sections` from the loaded JSON (array only). */
export function getCourseIntroSections() {
  const cc = state.courseCurriculum;
  if (!cc || cc.intro == null) return [];
  const intro = cc.intro;
  if (Array.isArray(intro)) return intro;
  const raw = intro.sections;
  return Array.isArray(raw) ? raw : [];
}

export function showIntroSection(index) {
  const sections = getCourseIntroSections();
  if (index >= sections.length) {
    document.getElementById('introScreen').classList.add('hidden');
    if (state.coursePart === 1) startLessonAfterIntro();
    return;
  }
  document.getElementById('introTitle').textContent = sections[index].title || 'Introduction';
  const introHtml = renderIntroContentHtml(sections[index].content || '');
  const diagramHtml = sections[index].diagram ? renderDiagram(sections[index].diagram) : '';
  const isOpenCloze = state.currentTopic && state.currentTopic.id === 'open_cloze';
  const isReportedSpeech = state.currentTopic && state.currentTopic.id === 'reported_speech';
  const isInfinitiveIng = state.currentTopic && state.currentTopic.id === 'infinitive_ing';
  document.getElementById('introContent').innerHTML = '<div class="intro-section">' + introHtml + '</div>' + diagramHtml;
  const isLastSection = index >= sections.length - 1;
  const hasCheckQuestions = ((state.courseCurriculum && state.courseCurriculum.check && state.courseCurriculum.check.questions) || []).length > 0;
  const lastLabel = hasCheckQuestions ? 'Start test' : (nextLessonPhaseAfter('check') ? 'Start practice' : 'Menu');
  document.getElementById('introNextBtn').textContent = !isLastSection ? 'Next' : lastLabel;
  document.getElementById('introMainMenuBtn').classList.toggle('hidden', document.getElementById('introNextBtn').textContent === 'Menu');
  state.introSectionIndex = index;
  document.getElementById('introPrepositionsListWrap').classList.add('hidden');
  document.getElementById('introPhrasalVerbsWrap').classList.add('hidden');
  const openClozeRefBar = document.getElementById('introOpenClozeRefBar');
  if (openClozeRefBar) openClozeRefBar.classList.toggle('hidden', !isOpenCloze);
  const reportedSpeechRefBar = document.getElementById('introReportedSpeechRefBar');
  if (reportedSpeechRefBar) reportedSpeechRefBar.classList.toggle('hidden', !isReportedSpeech);
  const infinitiveIngRefBar = document.getElementById('introInfinitiveIngRefBar');
  if (infinitiveIngRefBar) infinitiveIngRefBar.classList.toggle('hidden', !isInfinitiveIng);
  const total = sections.length;
  const ind = document.querySelector('#introScreen #introPageIndicator');
  if (ind) ind.textContent = total ? (index + 1) + ' / ' + total : '';
  scheduleIntroOverflowCheck(sections[index].title || 'Introduction');
}

export function showWritingTipsIntroSection(index) {
  const sections = (state.writingTipsData && state.writingTipsData.intro_sections) || [];
  if (index >= sections.length) return;
  document.getElementById('introTitle').textContent = sections[index].title || 'Writing Tips';
  const introHtml = escapeAndBold(sections[index].content || '').replace(/\n/g, '<br>');
  document.getElementById('introContent').innerHTML = '<div class="intro-section">' + introHtml + '</div>';
  const isLast = index >= sections.length - 1;
  document.getElementById('introNextBtn').textContent = isLast ? 'Start short test' : 'Next';
  document.getElementById('introMainMenuBtn').classList.remove('hidden');
  state.writingTipsIntroSectionIndex = index;
  document.getElementById('introPrepositionsListWrap').classList.add('hidden');
  document.getElementById('introPhrasalVerbsWrap').classList.add('hidden');
  const openClozeRefBar = document.getElementById('introOpenClozeRefBar');
  if (openClozeRefBar) openClozeRefBar.classList.add('hidden');
  const reportedSpeechRefBar = document.getElementById('introReportedSpeechRefBar');
  if (reportedSpeechRefBar) reportedSpeechRefBar.classList.add('hidden');
  const infinitiveIngRefBar = document.getElementById('introInfinitiveIngRefBar');
  if (infinitiveIngRefBar) infinitiveIngRefBar.classList.add('hidden');
  const total = sections.length;
  const ind = document.querySelector('#introScreen #introPageIndicator');
  if (ind) ind.textContent = total ? (index + 1) + ' / ' + total : '';
  scheduleIntroOverflowCheck(sections[index].title || 'Writing Tips');
}

export function startWritingTipsQuiz() {
  if (!state.writingTipsData || !state.writingTipsData.quiz || !state.writingTipsData.quiz.length) return;
  state.currentQuestions = state.writingTipsData.quiz.slice();
  state.currentSetTitle = state.writingTipsData.title || 'Writing Tips';
  state.currentSetId = 'writing_tips';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;
  state.quizMode = 'writing_tips';
  showScreen('quizScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  _showQuestion();
}

export function startCourseSection(phase) {
  state.coursePhase = phase;
  let questions = [];
  let title = '';
  if (phase === 'check') {
    const check = state.courseCurriculum.check || {};
    questions = (check.questions || []).slice();
    title = check.title || 'Test your understanding';
    state.currentSetId = 'course_check';
  } else {
    const practice = state.courseCurriculum.practice || {};
    const section = practice[phase];
    if (!section || !section.questions) {
      advanceCourseToNext();
      return;
    }
    questions = section.questions.slice();
    title = section.title || phase;
    state.currentSetId = 'course_' + phase;
  }
  state.currentSetTitle = title;
  state.currentQuestions = questions;
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;
  const warmupEl = document.getElementById('quizWarmupLine');
  if (warmupEl) {
    warmupEl.textContent = '';
    warmupEl.classList.add('hidden');
  }
  showScreen('quizScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  _showQuestion();
}

// The Intro lesson is one continuous journey: intro sections → check quiz →
// the guided rounds (curriculum practice_order), with the section-complete
// screen as the natural pause between rounds. Empty rounds are skipped.
export function lessonOrder() {
  return ['check'].concat(state.part2Order || []);
}

function nextLessonPhaseAfter(phase) {
  const order = lessonOrder();
  const practice = (state.courseCurriculum && state.courseCurriculum.practice) || {};
  for (let i = order.indexOf(phase) + 1; i < order.length; i++) {
    const s = practice[order[i]];
    if (s && s.questions && s.questions.length > 0) return order[i];
  }
  return null;
}

export function advanceCourseToNext() {
  document.getElementById('sectionCompleteScreen').classList.add('hidden');
  const nextPhase = state.coursePart ? nextLessonPhaseAfter(state.coursePhase) : null;
  if (!nextPhase) {
    state.coursePart = null;
    state.coursePhase = null;
    _renderMenu();
    return;
  }
  startCourseSection(nextPhase);
}

// Where the lesson goes when the intro sections run out: the check quiz if the
// topic has one, otherwise straight to the first guided round, otherwise menu.
export function startLessonAfterIntro() {
  const cc = state.courseCurriculum || {};
  if ((((cc.check || {}).questions) || []).length > 0) { startCourseSection('check'); return; }
  const first = nextLessonPhaseAfter('check');
  if (first) { startCourseSection(first); return; }
  state.coursePart = null;
  state.coursePhase = null;
  _renderMenu();
}

export async function startPart1() {
  if (!_hasValidTopicSelected()) { alert('Please choose a topic first.'); return; }
  _syncCurrentTopicFromDropdown();
  try { await _loadCurriculumData(); } catch (e) {
    var msg = window.location.protocol === 'file:' ? 'This app must run from a local server. Double-click start_server.bat in this folder, or run: python -m http.server 8080' : ('Could not load curriculum. ' + e.message);
    alert(msg); return;
  }
  saveLastActivity(state.currentTopic && state.currentTopic.id);
  state.writingTipsIntroActive = false;
  state.coursePart = 1;
  state.part2Order = state.courseCurriculum.practice_order || PART2_ORDER;
  showScreen('introScreen');
  document.body.classList.add('viewing-content');
  state.introSectionIndex = 0;
  showIntroSection(0);
}

export async function startDiagnostic(num) {
  num = Math.min(100, Math.max(20, parseInt(num, 10) || 50));
  let allData;
  try { allData = await fetchJSON('questions.json'); } catch (e) {
    alert('Could not load Grammar Test. ' + e.message); return;
  }
  const pool = [];
  (state.topics || []).forEach(function(t) {
    const key = t.questions_key || t.id;
    const sets = allData[key];
    if (!sets || typeof sets !== 'object') return;
    Object.entries(sets).forEach(function([setId, set]) {
      if (setId === 'set_staging') return; // exclude staging from Grammar Test pool
      const qs = set.questions || [];
      qs.forEach(function(q) {
        pool.push(Object.assign({}, q, { topic: t.id, topicTitle: t.title || _getTopicTitle(t.id) }));
      });
    });
  });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const max = Math.min(num, pool.length);
  state.currentQuestions = pool.slice(0, max);
  state.currentSetId = 'diagnostic';
  state.currentSetTitle = 'Grammar Test';
  state.summary = max + ' questions from all topics (random order). Wrong answers point to topics you need to revise.';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;
  state.quizMode = 'diagnostic';
  state.wrongTopics = new Set();
  showScreen('quizScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  _showQuestion();
}

export async function startMixedPractice() {
  let data;
  try { data = await fetchJSON('mixed_cloze.json'); } catch (e) {
    alert('Could not load mixed practice. ' + e.message); return;
  }
  const questions = (data.questions || []).slice();
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  state.currentQuestions = questions;
  state.currentSetId = 'mixed_practice';
  state.currentSetTitle = data.title_practice || 'Mixed cloze practice';
  state.summary = data.summary_practice || '';
  state.currentIndex = 0;
  state.score = 0;
  state.wrongIndices = [];
  state.isRetryRound = false;
  state.quizMode = 'practice';
  state.wrongTopics = new Set();
  showScreen('quizScreen');
  document.body.classList.add('viewing-content');
  document.getElementById('feedbackBlock').classList.add('hidden');
  document.getElementById('exitQuizBtn').textContent = 'Back';
  _showQuestion();
}

