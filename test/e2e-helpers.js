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

module.exports = { trackErrors, selectTopic, answerThroughQuiz, getTapRootLength };
