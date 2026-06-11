/**
 * Shared helpers for the Playwright E2E suite (smoke.spec.js, deeplinks.spec.js).
 * Not a spec file itself — playwright.config.js only matches *.spec.js.
 */
const { expect } = require('@playwright/test');

/**
 * Collect console errors, page errors and unexpected dialogs so tests can
 * assert the journey produced none. Call before page.goto().
 */
function trackErrors(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', async d => {
    errors.push('dialog: ' + d.message());
    await d.dismiss().catch(() => {});
  });
  return errors;
}

/** Open the topic select panel and choose the first topic whose label contains matchText. */
async function selectTopic(page, matchText) {
  await page.click('#openTopicSelectBtn');
  await expect(page.locator('#menuTopicSelect')).toBeVisible();
  const option = page.locator('#topicSelect option', { hasText: matchText }).first();
  const value = await option.getAttribute('value');
  await page.selectOption('#topicSelect', value);
}

/**
 * Answer questions on the quiz screen until a finish screen appears.
 * MC questions: click the first option (auto-submits). Open questions: type a
 * dummy answer and submit. Correctness doesn't matter for flow coverage.
 * Returns 'result' or 'sectionComplete' depending on which screen ended the quiz.
 */
async function answerThroughQuiz(page, maxQuestions = 60) {
  for (let i = 0; i < maxQuestions; i++) {
    if (await page.locator('#resultScreen').isVisible()) return 'result';
    if (await page.locator('#sectionCompleteScreen').isVisible()) return 'sectionComplete';

    if (await page.locator('#mcBlock').isVisible()) {
      await page.locator('#mcBlock .option').first().click();
    } else if (await page.locator('#openInput').isVisible()) {
      await page.fill('#openInput', 'test answer');
      await page.click('#submitBtn');
    } else {
      await page.waitForTimeout(150);
      continue;
    }
    await expect(page.locator('#feedbackBlock')).toBeVisible();
    await page.click('#nextBtn');
  }
  throw new Error('Quiz did not finish within ' + maxQuestions + ' questions');
}

/**
 * Answer questions CORRECTLY using questions.json as the answer key.
 * Matches the displayed prompt against the topic's question pool, then clicks
 * the correct MC option or types the first accepted answer.
 * Returns 'result' or 'sectionComplete'.
 */
async function answerThroughQuizCorrectly(page, questionsKey, maxQuestions = 60) {
  const sets = require('../questions.json')[questionsKey] || {};
  const pool = Object.values(sets).flatMap(s => s.questions || []);
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < maxQuestions; i++) {
    if (await page.locator('#resultScreen').isVisible()) return 'result';
    if (await page.locator('#sectionCompleteScreen').isVisible()) return 'sectionComplete';

    const shown = norm(await page.locator('#questionText').textContent());
    // Error-correction items display a transformed fragment (e.g. "Wrong: <sentence>"),
    // so match in both directions: pool-core within shown, or shown-core within pool text.
    const shownCore = shown.replace(/^wrong/, '');
    const q = pool.find(p => {
      const full = norm(p.question || p.prompt || '');
      const core = full.replace(/^\d+/, '').slice(0, 40);
      return (core.length > 10 && shown.includes(core)) ||
             (shownCore.length > 8 && full.includes(shownCore));
    });
    if (!q) throw new Error('No answer-key match for displayed question: ' + shown.slice(0, 80));

    if (q.type === 'mc') {
      await page.locator(`#mcBlock .option[data-option="${q.correct_option}"]`).click();
    } else {
      await page.fill('#openInput', (q.answers && q.answers[0]) || '');
      await page.click('#submitBtn');
    }
    await expect(page.locator('#feedbackBlock')).toBeVisible();
    await page.click('#nextBtn');
  }
  throw new Error('Quiz did not finish within ' + maxQuestions + ' questions');
}

/**
 * Read a family node's circle radius and tooltip text from the tree SVG,
 * identified by the family name inside its <title>.
 */
async function getFamilyNode(page, familyName) {
  await page.click('#showTreeBtn');
  await expect(page.locator('#treeRootsVisual svg')).toBeVisible();
  const node = await page.evaluate((name) => {
    const titles = Array.from(document.querySelectorAll('#treeRootsVisual svg g title'));
    const t = titles.find(el => el.textContent.includes(name));
    if (!t) return null;
    const circle = t.parentElement.querySelector('circle');
    return { r: parseFloat(circle.getAttribute('r')), title: t.textContent };
  }, familyName);
  await page.click('#treeOverviewBackBtn');
  if (!node) throw new Error('Family node not found in tree: ' + familyName);
  return node;
}

/**
 * Open the Grammar Tree panel and measure the central tap-root line length.
 * Thickness/length are driven by real progress, so this grows after a quiz.
 */
async function getTapRootLength(page) {
  await page.click('#showTreeBtn');
  await expect(page.locator('#treeRootsVisual svg')).toBeVisible();
  const line = page.locator('#treeRootsVisual svg line').first();
  const y1 = parseFloat(await line.getAttribute('y1'));
  const y2 = parseFloat(await line.getAttribute('y2'));
  await page.click('#treeOverviewBackBtn');
  return y2 - y1;
}

module.exports = { trackErrors, selectTopic, answerThroughQuiz, answerThroughQuizCorrectly, getFamilyNode, getTapRootLength };
